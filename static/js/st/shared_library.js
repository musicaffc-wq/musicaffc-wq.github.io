// Biblioteca compartilhada: lê os arquivos .ly de uma pasta pública num
// repositório do GitHub. Não precisa de token nenhum pra LER (repositório
// público) -- só quem tem o token consegue ENVIAR arquivos (isso é feito
// em st/github_api.js, dentro do editor).
//
// A API do GitHub sem autenticação tem um limite de 60 requisições por
// hora POR ENDEREÇO IP -- se várias pessoas usam o app na mesma rede
// (mesmo Wi-Fi, escola, empresa, operadora), elas compartilham esse
// mesmo limite. Por isso guardamos a última lista carregada com um prazo
// de validade: dentro desse prazo, nem chegamos a chamar a API de novo; e
// se a chamada falhar (rede fora do ar OU limite estourado), caímos de
// volta pra última lista conhecida em vez de simplesmente dar erro.

import {readConfig, writeConfig} from "st/config"

const API_ROOT = "https://api.github.com"
const CACHE_KEY = "shared_library_cache"
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

// dono/repositório/pasta padrão da biblioteca compartilhada oficial deste
// app. Qualquer pessoa que instalar o app enxerga essa mesma pasta,
// mesmo sem nunca ter configurado nada.
export const DEFAULT_LIBRARY = {
  owner: "musicaffc-wq",
  repo: "musicaffc-wq.github.io",
  folder: "static/music/community",
}

// extrai "% Title: ..." do começo do arquivo, se existir
function extractTitle(text, fallback) {
  let m = /^%\s*Title:\s*(.+)$/m.exec(text)
  return (m && m[1].trim()) || fallback
}

// lista os arquivos .ly disponíveis na pasta compartilhada, já com o
// título de verdade (lido de dentro de cada arquivo, não adivinhado pelo
// nome do arquivo -- o nome do arquivo pode ter sido "achatado" pra caber
// num nome de arquivo válido, mas o título salvo dentro do arquivo é o
// texto original, com acentos e tudo)
//
// devolve {songs, fromCache, cachedAt, stale}
export async function listSharedSongs({owner, repo, folder} = DEFAULT_LIBRARY) {
  let cached = readConfig(CACHE_KEY)
  let cacheIsFresh = cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS

  // dentro do prazo de validade: nem chama a API, usa o que já temos
  if (cacheIsFresh) {
    return {songs: cached.songs, fromCache: true, cachedAt: cached.cachedAt, stale: false}
  }

  try {
    let songs = await fetchSharedSongsFromApi({owner, repo, folder})
    writeConfig(CACHE_KEY, {songs, cachedAt: Date.now()})
    return {songs, fromCache: false, cachedAt: Date.now(), stale: false}
  } catch (err) {
    // se der erro (rede, ou limite de requisições da API estourado) mas
    // tivermos uma versão antiga guardada, mostra ela em vez de dar erro
    if (cached) {
      return {songs: cached.songs, fromCache: true, cachedAt: cached.cachedAt, stale: true, error: err}
    }
    throw err
  }
}

async function fetchSharedSongsFromApi({owner, repo, folder}) {
  let url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURI(folder)}`

  let res = await fetch(url, {
    headers: {"Accept": "application/vnd.github+json"},
  })

  if (res.status === 404) {
    return [] // pasta ainda não existe / está vazia
  }

  if (!res.ok) {
    let body = await res.text()
    throw new Error(`Não foi possível carregar a biblioteca (${res.status}): ${body}`)
  }

  let entries = await res.json()
  let files = entries.filter(e => e.type === "file" && /\.ly$/i.test(e.name))

  let songs = await Promise.all(files.map(async e => {
    let fallbackTitle = e.name.replace(/\.ly$/i, "").replace(/-/g, " ")
    let title = fallbackTitle

    try {
      let text = await fetchSharedSongContent(e.download_url)
      title = extractTitle(text, fallbackTitle)
    } catch (err) {
      // se der erro ao ler um arquivo específico, ainda mostra ele na
      // lista (com o título aproximado do nome do arquivo) em vez de
      // sumir com ele da lista inteira
    }

    return {
      name: e.name,
      title,
      downloadUrl: e.download_url,
      sha: e.sha,
    }
  }))

  return songs.sort((a, b) => a.title.localeCompare(b.title, "pt-BR", {sensitivity: "base"}))
}

// atualiza o cache local diretamente (usado depois de excluir uma música,
// pra lista não voltar a mostrar o item apagado enquanto o cache não expira)
export function updateCachedSongs(songs) {
  writeConfig(CACHE_KEY, {songs, cachedAt: Date.now()})
}

// baixa o conteúdo de uma música específica da biblioteca compartilhada
export async function fetchSharedSongContent(downloadUrl) {
  let res = await fetch(downloadUrl)
  if (!res.ok) {
    throw new Error(`Não foi possível baixar a música (${res.status})`)
  }
  return res.text()
}
