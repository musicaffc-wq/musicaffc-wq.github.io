// Envia arquivos direto para um repositório do GitHub usando a API REST
// (Contents API), sem precisar de nenhum servidor próprio -- tudo roda no
// navegador, direto pro github.com.
//
// IMPORTANTE (segurança): o token de acesso é guardado só no localStorage
// deste dispositivo (via st/config) e é usado apenas para chamadas diretas
// à api.github.com. Ele nunca é enviado para nenhum outro lugar. Ainda
// assim, use sempre um token "fine-grained" com acesso limitado a UM
// repositório e à permissão "Contents: Read and write" -- nunca um token
// com acesso total à conta.

const API_ROOT = "https://api.github.com"

function utf8ToBase64(str) {
  let bytes = new TextEncoder().encode(str)
  let binary = ""
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

async function githubRequest(url, token, opts = {}) {
  let res = await fetch(url, {
    ...opts,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {}),
    },
  })
  return res
}

// busca o sha do arquivo atual, se ele já existir (necessário pra
// atualizar um arquivo existente); devolve null se o arquivo não existe
export async function getExistingFileSha({owner, repo, path, token, branch}) {
  let url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURI(path)}`
  if (branch) url += `?ref=${encodeURIComponent(branch)}`

  let res = await githubRequest(url, token)
  if (res.status === 404) return null
  if (!res.ok) {
    let body = await res.text()
    throw new Error(`Falha ao verificar arquivo existente (${res.status}): ${body}`)
  }
  let data = await res.json()
  return data.sha
}

// cria ou atualiza um arquivo no repositório
export async function putFile({owner, repo, path, content, message, token, branch}) {
  if (!owner || !repo || !token) {
    throw new Error("Preencha usuário, repositório e token do GitHub antes de enviar.")
  }

  let sha = await getExistingFileSha({owner, repo, path, token, branch})

  let url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURI(path)}`
  let body = {
    message: message || `Update ${path}`,
    content: utf8ToBase64(content),
  }
  if (sha) body.sha = sha
  if (branch) body.branch = branch

  let res = await githubRequest(url, token, {
    method: "PUT",
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errBody = await res.text()
    throw new Error(`Falha ao enviar pro GitHub (${res.status}): ${errBody}`)
  }

  return res.json()
}

// apaga um arquivo do repositório (usado para remover músicas da
// biblioteca compartilhada)
export async function deleteFile({owner, repo, path, token, branch, message}) {
  if (!owner || !repo || !token) {
    throw new Error("Preencha usuário, repositório e token do GitHub antes de excluir.")
  }

  let sha = await getExistingFileSha({owner, repo, path, token, branch})
  if (!sha) {
    throw new Error("Esse arquivo não foi encontrado no repositório.")
  }

  let url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURI(path)}`
  let body = {
    message: message || `Delete ${path}`,
    sha,
  }
  if (branch) body.branch = branch

  let res = await githubRequest(url, token, {
    method: "DELETE",
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errBody = await res.text()
    throw new Error(`Falha ao excluir do GitHub (${res.status}): ${errBody}`)
  }

  return res.json()
}
