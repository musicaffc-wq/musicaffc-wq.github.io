import * as React from "react"
import {useNavigate} from "react-router-dom"

import {listSharedSongs, fetchSharedSongContent, updateCachedSongs, DEFAULT_LIBRARY} from "st/shared_library"
import {deleteFile} from "st/github_api"
import {readConfig, writeConfig} from "st/config"
import {setTitle} from "st/globals"

import styles from "st/components/pages/shared_library_page.module.css"

function friendlyError(err) {
  return /failed to fetch/i.test(err.message)
    ? "Não foi possível conectar à internet agora. Confira sua conexão (Wi-Fi/dados) e tente de novo."
    : err.message
}

export default function SharedLibraryPage() {
  let [songs, setSongs] = React.useState(null)
  let [error, setError] = React.useState(null)
  let [staleNotice, setStaleNotice] = React.useState(null)
  let [openingName, setOpeningName] = React.useState(null)
  let [managing, setManaging] = React.useState(false)
  let [deletingName, setDeletingName] = React.useState(null)
  let [searchQuery, setSearchQuery] = React.useState("")
  let navigate = useNavigate()

  // config do GitHub -- é a MESMA guardada pelo painel "Enviar pro GitHub"
  // do editor. Só quem já configurou um token aqui (ou seja, só o dono da
  // biblioteca) enxerga os botões de excluir.
  let githubConfig = readConfig("github_publish") || {}
  let canManage = !!(githubConfig.owner && githubConfig.repo && githubConfig.token)

  function loadSongs() {
    setError(null)
    setStaleNotice(null)
    setSongs(null)

    listSharedSongs(DEFAULT_LIBRARY)
      .then(result => {
        setSongs(result.songs)
        if (result.stale) {
          setStaleNotice(
            "Não deu pra atualizar agora (provavelmente muita gente usando " +
            "a mesma rede ao mesmo tempo) -- mostrando a última lista salva."
          )
        }
      })
      .catch(err => setError(friendlyError(err)))
  }

  React.useEffect(() => {
    setTitle("Biblioteca compartilhada")
    loadSongs()
  }, [])

  let filteredSongs = React.useMemo(() => {
    if (!songs) return null

    let query = searchQuery.trim().toLocaleLowerCase("pt-BR")
      .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")

    if (!query) return songs

    return songs.filter(song => {
      let title = String(song.title || "").toLocaleLowerCase("pt-BR")
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
      let name = String(song.name || "").toLocaleLowerCase("pt-BR")
        .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")

      return title.includes(query) || name.includes(query)
    })
  }, [songs, searchQuery])

  async function openSong(song) {
    setOpeningName(song.name)
    setError(null)

    try {
      let text = await fetchSharedSongContent(song.downloadUrl)

      // separa os comentários de metadados (Title/Artist/Source/Album),
      // do mesmo jeito que o editor faz ao abrir um arquivo local
      let meta = {}
      let codeLines = []
      text.split("\n").forEach(line => {
        let m = /^%\s*(Title|Artist|Source|Album):\s*(.*)$/.exec(line)
        if (m) {
          meta[m[1].toLowerCase()] = m[2]
        } else {
          codeLines.push(line)
        }
      })

      let code = codeLines.join("\n").replace(/^\s+/, "")

      writeConfig("wip:newSong", {
        title: meta.title || song.title,
        code,
        source: meta.source || "",
        artist: meta.artist || "",
        album: meta.album || "",
        sourceFileName: song.name,
      })

      navigate("/new-song")
    } catch (err) {
      setError(friendlyError(err))
      setOpeningName(null)
    }
  }

  async function deleteSong(song, e) {
    e.stopPropagation()

    if (!window.confirm(`Excluir "${song.title}" da biblioteca compartilhada? Essa ação não pode ser desfeita.`)) {
      return
    }

    setDeletingName(song.name)
    setError(null)

    try {
      await deleteFile({
        owner: githubConfig.owner,
        repo: githubConfig.repo,
        token: githubConfig.token,
        path: `${DEFAULT_LIBRARY.folder}/${song.name}`,
        message: `Remove song: ${song.title}`,
      })

      setSongs(current => {
        let updated = current.filter(s => s.name !== song.name)
        updateCachedSongs(updated)
        return updated
      })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setDeletingName(null)
    }
  }

  return <div className={styles.shared_library_page}>
    <h2>Biblioteca compartilhada</h2>
    <p className={styles.explanation}>
      Músicas enviadas por Léo Café, disponíveis para todo mundo que usa este
      aplicativo. Toque numa música para abri-la no editor -- depois, use
      "Salvar no dispositivo" se quiser guardar sua própria cópia.
    </p>

    <div className={styles.search_box}>
      <label htmlFor="shared-library-search">Pesquisar música</label>
      <input
        id="shared-library-search"
        type="search"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Digite o nome da música..."
        autoComplete="off"
      />
    </div>

    {canManage ? <button
      type="button"
      className={styles.manage_button}
      onClick={() => setManaging(!managing)}>
      {managing ? "Concluir gerenciamento" : "Gerenciar (excluir músicas)"}
    </button> : null}

    {error ? <div className={styles.error_message}>
      {error}
      <button type="button" onClick={loadSongs}>Tentar de novo</button>
    </div> : null}

    {staleNotice ? <div className={styles.stale_notice}>{staleNotice}</div> : null}

    {songs === null && !error ? <p>Carregando...</p> : null}

    {songs && songs.length === 0 ? <p>Nenhuma música na biblioteca compartilhada ainda.</p> : null}

    {songs && songs.length > 0 && filteredSongs.length === 0
      ? <p>Nenhuma música encontrada para "{searchQuery}".</p>
      : null}

    {filteredSongs && filteredSongs.length > 0 ? <ul className={styles.song_list}>
      {filteredSongs.map((song, idx) =>
        <li key={song.name} className={styles.song_item} onClick={() => !managing && openSong(song)}>
          <span className={styles.song_title}>
            <span className={styles.song_number}>{idx + 1}.</span> {song.title}
          </span>
          {managing
            ? <button
                type="button"
                className={styles.delete_button}
                disabled={deletingName === song.name}
                onClick={(e) => deleteSong(song, e)}>
                {deletingName === song.name ? "Excluindo..." : "Excluir"}
              </button>
            : <span className={styles.song_action}>
                {openingName === song.name ? "Abrindo..." : "Abrir"}
              </span>
          }
        </li>
      )}
    </ul> : null}
  </div>
}
