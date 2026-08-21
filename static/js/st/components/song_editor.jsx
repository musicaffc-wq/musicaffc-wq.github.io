import * as React from "react"
import classNames from "classnames"
import SongParser from "st/song_parser"
import {trigger} from "st/events"

import {JsonForm, TextInputRow} from "st/components/forms"
import {useNavigate} from "react-router-dom"

import Lightbox from "st/components/lightbox"
import Tabs from "st/components/tabs"
import Select from "st/components/select"
import styles from "st/components/song_editor.module.css"

import { KeySignature } from "st/music"
import {readConfig, writeConfig} from "st/config"
import {listLocalSongs, saveLocalSong, deleteLocalSong} from "st/local_songs"
import {putFile} from "st/github_api"

const DeleteSongForm = React.memo(function DeleteSongForm(props) {
  const navigate = useNavigate()

  function afterSubmit(res) {
    props.lightbox.close()
    if (res.redirect_to) {
      navigate(res.redirect_to)
    }
  }

  return <JsonForm
    method="DELETE"
    action={props.action}
    afterSubmit={afterSubmit}
    className="delete_song_form">
      <p>Are you sure you want to delete this song? You can't un-delete</p>
      <button>Delete</button>
  </JsonForm>
})

class SongDetailsLightbox extends Lightbox {
  constructor(opts) {
    super(opts)
    this.state = { tab: "details" }
  }

  renderContent() {
    return <React.Fragment>
      <h2>More options</h2>
      <Tabs
        currentTab={this.state.tab}
        onChangeTab={t => this.setState({tab: t.name})}
        tabs={[
          {name: "details", label: "Details"},
          {name: "delete", label: "Delete"},
        ]}
      />
      {this.renderCurrentTab()}
    </React.Fragment>
  }

  renderCurrentTab() {
    switch (this.state.tab) {
      case "details":
        return this.renderDetails()
      case "delete":
        return <DeleteSongForm lightbox={this} action={this.props.action}/>
    }
  }

  renderDetails() {
    return<div>
      <p>
        <strong>Created at: </strong>
        {this.props.song.created_at}
      </p>

      <p>
        <strong>Updated at: </strong>
        {this.props.song.updated_at}
      </p>
    </div>
  }
}

export default class SongEditor extends React.Component {
  constructor(props) {
    super(props)

    let song = this.props.song

    this.notesCountInputRef = React.createRef()
    this.beatsLengthInputRef = React.createRef()
    this.codeInputRef = React.createRef()
    this.fileInputRef = React.createRef()
    this.batchFileInputRef = React.createRef()

    this.fieldUpdaters = {
      code: e => this.updateCode(e.target.value)
    }

    let initial = song
    if (!song) {
      initial = readConfig("wip:newSong")
      // render the initial song
      if (initial) {
        window.setTimeout(() => {
          if (this.state.code == initial.code) {
            if (this.props.onCode) {
              this.props.onCode(initial.code)
            }
          }
        }, 0)
      }
    }

    this.state = {
      song,
      newSong: !song,
      loading: false,

      title: initial ? initial.title : "",
      code: this.props.code || (initial ? initial.code : null) || "",
      source: initial ? initial.source : "",
      album: initial ? initial.album : "",
      artist: initial ? initial.artist : "",
      publishStatus: initial ? initial.publish_status : undefined,

      // nome do arquivo de origem, quando esta música foi aberta a partir
      // da biblioteca compartilhada -- usado para SOBRESCREVER o mesmo
      // arquivo no GitHub em vez de criar um novo ao reenviar
      sourceFileName: initial ? initial.sourceFileName || null : null,

      localSongId: null,
      localSongs: listLocalSongs(),
      showLocalSongs: false,
      localSaveMessage: null,

      showGithubPanel: false,
      githubBusy: false,
      githubMessage: null,
      ...(readConfig("github_publish") || {owner: "", repo: "", token: "", folder: "static/music/community"}),

      batchImporting: false,
      batchImportStatus: [],
    }
  }

  updateCode(code, callback) {
    let update = { code }
    this.setState(update, callback)
    this.updateWip(update)
    this.autoSaveLocal({code})

    if (this.props.onCode) {
      this.props.onCode(code)
    }
  }

  // se já existe uma música local associada a essa sessão de edição, toda
  // mudança (código ou campos de texto) é salva automaticamente nela --
  // sem precisar clicar em "Salvar" de novo
  autoSaveLocal(partialUpdate) {
    if (!this.state.localSongId) {
      return
    }

    let merged = Object.assign({
      title: this.state.title,
      code: this.state.code,
    }, partialUpdate)

    let entry = saveLocalSong({
      id: this.state.localSongId,
      title: merged.title,
      code: merged.code,
    })

    this.setState({localSongs: listLocalSongs()})
    return entry
  }

  // ---- banco de músicas local (funciona sem servidor) ----

  saveLocalCopy() {
    let entry = saveLocalSong({
      id: this.state.localSongId,
      title: this.state.title || "Untitled",
      code: this.state.code,
    })

    this.setState({
      localSongId: entry.id,
      localSongs: listLocalSongs(),
      localSaveMessage: "Música salva no dispositivo.",
    })

    window.clearTimeout(this._localMsgTimeout)
    this._localMsgTimeout = window.setTimeout(() => {
      this.setState({localSaveMessage: null})
    }, 2500)
  }

  openLocalSongById(id) {
    let entry = listLocalSongs().find(s => s.id == id)
    if (!entry) {
      return
    }

    this.setState({
      localSongId: entry.id,
      title: entry.title,
      code: entry.code,
      showLocalSongs: false,
    })

    if (this.props.onCode) {
      this.props.onCode(entry.code)
    }
  }

  deleteLocalSongById(id, e) {
    if (e) {
      e.stopPropagation()
    }

    if (!window.confirm("Apagar esta música salva no dispositivo? Essa ação não pode ser desfeita.")) {
      return
    }

    deleteLocalSong(id)

    let update = {localSongs: listLocalSongs()}
    if (this.state.localSongId == id) {
      update.localSongId = null
    }
    this.setState(update)
  }

  toggleLocalSongsList() {
    this.setState({
      showLocalSongs: !this.state.showLocalSongs,
      localSongs: listLocalSongs(),
    })
  }

  // gera o texto do arquivo .ly (com um pequeno cabeçalho de metadados como
  // comentários, já que LilyPond ignora linhas começadas com "%")
  buildLilypondFileContents() {
    let lines = []
    if (this.state.title) lines.push(`% Title: ${this.state.title}`)
    if (this.state.artist) lines.push(`% Artist: ${this.state.artist}`)
    if (this.state.source) lines.push(`% Source: ${this.state.source}`)
    if (this.state.album) lines.push(`% Album: ${this.state.album}`)
    if (lines.length) lines.push("")
    lines.push(this.state.code || "")
    return lines.join("\n")
  }

  safeFileName() {
    let base = (this.state.title || "song").trim().toLowerCase()
    // mantém letras (incluindo acentuadas e cedilha) e números; troca
    // qualquer outra coisa (espaço, pontuação, símbolos) por hífen
    base = base.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "")
    return `${base || "song"}.ly`
  }

  exportToFile() {
    let blob = new Blob([this.buildLilypondFileContents()], {type: "text/plain;charset=utf-8"})
    let url = URL.createObjectURL(blob)
    let a = document.createElement("a")
    a.href = url
    a.download = this.safeFileName()
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  openFilePicker() {
    if (this.fileInputRef.current) {
      this.fileInputRef.current.value = ""
      this.fileInputRef.current.click()
    }
  }

  onFileChosen(e) {
    let file = e.target.files && e.target.files[0]
    if (!file) {
      return
    }

    if (/\.json$/i.test(file.name)) {
      this.importBankFromFile(file)
      return
    }

    let reader = new FileReader()
    reader.onload = () => {
      let text = String(reader.result || "")

      // separa os comentários de metadados (se vieram de um export nosso)
      // do código de verdade
      let metaMatch = {}
      let codeLines = []
      text.split("\n").forEach(line => {
        let m = /^%\s*(Title|Artist|Source|Album):\s*(.*)$/.exec(line)
        if (m) {
          metaMatch[m[1].toLowerCase()] = m[2]
        } else {
          codeLines.push(line)
        }
      })

      let code = codeLines.join("\n").replace(/^\s+/, "")
      let titleFromFile = metaMatch.title || file.name.replace(/\.ly$/i, "")

      this.setState({
        title: metaMatch.title !== undefined ? metaMatch.title : titleFromFile,
        source: metaMatch.source || this.state.source,
        artist: metaMatch.artist || this.state.artist,
        album: metaMatch.album || this.state.album,
        code,
        localSongId: null,
        sourceFileName: null,
      })

      if (this.props.onCode) {
        this.props.onCode(code)
      }
    }
    reader.readAsText(file, "UTF-8")
  }

  importBankFromFile(file) {
    let reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(String(reader.result))
      } catch (e) {
        window.alert("Esse arquivo não é um banco de músicas válido.")
        return
      }

      let songs = data.songs || []
      if (!Array.isArray(songs) || !songs.length) {
        window.alert("Nenhuma música encontrada nesse arquivo.")
        return
      }

      songs.forEach(s => {
        saveLocalSong({
          // gera um novo id local pra não sobrescrever nada existente por acidente
          title: s.title,
          code: s.code,
        })
      })

      this.setState({localSongs: listLocalSongs()})
      window.alert(`${songs.length} música(s) importada(s) com sucesso.`)
    }
    reader.readAsText(file, "UTF-8")
  }

  // ---- integração com GitHub ----

  updateGithubField(field, value) {
    let update = {[field]: value}
    this.setState(update)

    let toSave = {
      owner: field == "owner" ? value : this.state.owner,
      repo: field == "repo" ? value : this.state.repo,
      token: field == "token" ? value : this.state.token,
      folder: field == "folder" ? value : this.state.folder,
    }
    writeConfig("github_publish", toSave)
  }

  toggleGithubPanel() {
    this.setState({showGithubPanel: !this.state.showGithubPanel})
  }

  // ---- importação em lote (vários arquivos .ly de uma vez) ----

  openBatchFilePicker() {
    if (this.batchFileInputRef.current) {
      this.batchFileInputRef.current.value = ""
      this.batchFileInputRef.current.click()
    }
  }

  parseLyText(text, fallbackTitle) {
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

    return {
      title: meta.title || fallbackTitle,
      source: meta.source || "",
      artist: meta.artist || "",
      album: meta.album || "",
      code: codeLines.join("\n").replace(/^\s+/, ""),
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(reader.error || new Error("Falha ao ler o arquivo"))
      reader.readAsText(file, "UTF-8")
    })
  }

  async onBatchFilesChosen(e) {
    let files = Array.from(e.target.files || []).filter(f => /\.ly$/i.test(f.name))
    if (!files.length) {
      return
    }

    let canPublish = !!(this.state.owner && this.state.repo && this.state.token)
    let folder = (this.state.folder || "static/music/community").replace(/\/+$/, "")

    this.setState({
      batchImporting: true,
      batchImportStatus: files.map(f => ({name: f.name, status: "pendente"})),
    })

    let setFileStatus = (name, status) => {
      this.setState(prev => ({
        batchImportStatus: prev.batchImportStatus.map(s => s.name === name ? {...s, status} : s)
      }))
    }

    for (let file of files) {
      try {
        let text = await this.readFileAsText(file)
        let fallbackTitle = file.name.replace(/\.ly$/i, "")
        let parsed = this.parseLyText(text, fallbackTitle)

        // sempre guarda uma cópia no banco local do dispositivo
        saveLocalSong({title: parsed.title, code: parsed.code})

        if (canPublish) {
          setFileStatus(file.name, "enviando pro GitHub...")
          let contents = [
            `% Title: ${parsed.title}`,
            parsed.artist ? `% Artist: ${parsed.artist}` : null,
            parsed.source ? `% Source: ${parsed.source}` : null,
            parsed.album ? `% Album: ${parsed.album}` : null,
            "",
            parsed.code,
          ].filter(l => l !== null).join("\n")

          await putFile({
            owner: this.state.owner,
            repo: this.state.repo,
            token: this.state.token,
            path: `${folder}/${file.name}`,
            content: contents,
            message: `Batch import: ${parsed.title}`,
          })
          setFileStatus(file.name, "✓ enviado pro GitHub e salvo no dispositivo")
        } else {
          setFileStatus(file.name, "✓ salvo no dispositivo (configure o GitHub acima para também enviar)")
        }
      } catch (err) {
        setFileStatus(file.name, `✗ erro: ${err.message}`)
      }
    }

    this.setState({
      batchImporting: false,
      localSongs: listLocalSongs(),
    })
  }

  async publishToGithub() {
    if (!this.state.owner || !this.state.repo || !this.state.token) {
      this.setState({githubMessage: "Preencha usuário, repositório e token antes de enviar."})
      return
    }

    this.setState({githubBusy: true, githubMessage: null})

    let folder = (this.state.folder || "static/music/community").replace(/\/+$/, "")
    // se a música foi aberta a partir da biblioteca compartilhada, reusa o
    // MESMO nome de arquivo para sobrescrever em vez de criar um novo
    let fileName = this.state.sourceFileName || this.safeFileName()
    let path = `${folder}/${fileName}`

    try {
      await putFile({
        owner: this.state.owner,
        repo: this.state.repo,
        token: this.state.token,
        path,
        content: this.buildLilypondFileContents(),
        message: `Add/update song: ${this.state.title || this.safeFileName()}`,
      })

      this.setState({
        githubBusy: false,
        githubMessage: `Enviado com sucesso para ${path}`,
      })
    } catch (err) {
      this.setState({
        githubBusy: false,
        githubMessage: `Erro: ${err.message}`,
      })
    }
  }

  async shareCurrentSong() {
    let contents = this.buildLilypondFileContents()
    let filename = this.safeFileName()

    if (navigator.share) {
      try {
        if (navigator.canShare && navigator.canShare({files: [new File([contents], filename)]})) {
          await navigator.share({
            files: [new File([contents], filename, {type: "text/plain;charset=utf-8"})],
            title: this.state.title || "Song",
          })
          return
        }
      } catch (e) {
        // usuário cancelou ou o compartilhamento de arquivo falhou -- cai
        // para o fallback de copiar/baixar abaixo
      }
    }

    // navegadores sem suporte a compartilhar arquivos: baixa o arquivo
    this.exportToFile()
  }

  async shareAllLocalSongs() {
    let songs = listLocalSongs()
    if (!songs.length) {
      window.alert("Nenhuma música salva no dispositivo ainda.")
      return
    }

    let payload = JSON.stringify({songs, exportedAt: new Date().toISOString()}, null, 2)
    let filename = "minhas-musicas-sightreading.json"

    if (navigator.share) {
      try {
        let file = new File([payload], filename, {type: "application/json"})
        if (navigator.canShare && navigator.canShare({files: [file]})) {
          await navigator.share({files: [file], title: "Minhas músicas"})
          return
        }
      } catch (e) {
        // cai para o download abaixo
      }
    }

    let blob = new Blob([payload], {type: "application/json"})
    let url = URL.createObjectURL(blob)
    let a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  beforeSubmit() {
    if (this.props.songNotes) {
      this.notesCountInputRef.current.value = this.props.songNotes.length
      let duration = Math.max(...this.props.songNotes.map((n) => n.getStop()))
      this.beatsLengthInputRef.current.value = duration
    }

    this.setState({
      errors: null,
    })
  }

  afterSubmit(res) {
    if (res.errors) {
      this.setState({
        errors: res.errors
      })
    }

    if (res.song) {
      this.setState({
        newSong: false,
        song: res.song
      })
      writeConfig("wip:newSong", undefined)
    }
  }

  updateWip(update) {
    if (!this.state.newSong) {
      return false
    }

    let wip = readConfig("wip:newSong") || {}
    wip = Object.assign({}, wip, update)
    writeConfig("wip:newSong", wip)
    return true
  }

  render() {
    let action = "/songs.json"
    if (this.state.song && this.state.song.allowed_to_edit) {
      action = `/songs/${this.state.song.id}.json`
    }

    let errors

    if (this.state.errors) {
      errors = <ul>{this.state.errors.map(e => <li key={e}>{e}</li>)}</ul>
    }

    let moreButton, saveButton

    if (this.state.song && this.state.song.allowed_to_edit) {
      moreButton = <button
        onClick={e => {
          trigger(this, "showLightbox",
            <SongDetailsLightbox action={action} song={this.state.song}/>)
        }}
        type="button" className="outline">More...</button>
    }

    if (this.state.song && !this.state.song.allowed_to_edit) {
      saveButton = <button>Save copy</button>
    } else if (this.state.song) {
      saveButton = <button>Save</button>
    } else {
      saveButton = <button>Save new song</button>
    }

    let originalSongIdInput

    if (this.state.song && !this.state.song.allowed_to_edit) {
      originalSongIdInput = <input type="hidden" name="song[original_song_id]" value={this.state.song.id} />
    }

    let songVisibility

    if (!this.state.song || this.state.song.allowed_to_edit) {
      songVisibility = <Select
        className={styles.select_component}
        name="song[publish_status]"
        value={this.state.publishStatus}
        onChange={value => {
          this.setState({
            publishStatus: value
          })
        }}
        options={[
          {value: "draft", name: "Unlisted"},
          {value: "public", name: "Public"},
        ]}
      />
    }


    let hasAutochords = false

    if (this.props.songNotes && this.props.songNotes.autoChords) {
      hasAutochords = true
    }

    return <React.Fragment>
    <JsonForm
      action={action}
      beforeSubmit={this.beforeSubmit.bind(this)}
      afterSubmit={this.afterSubmit.bind(this)}
      className={styles.song_editor}>
      <input type="hidden" ref={this.notesCountInputRef} name="song[notes_count]" />
      <input type="hidden" ref={this.beatsLengthInputRef} name="song[beats_duration]" />
      <input type="hidden" value={hasAutochords ? "true" : ""} name="song[has_autochords]" />
      {originalSongIdInput}

      <textarea
        ref={this.codeInputRef}
        placeholder="Type some LilyPond, e.g. \relative c' { c4 d e f }"
        disabled={this.state.loading}
        name="song[song]"
        value={this.state.code}
        onChange={this.fieldUpdaters.code}></textarea>

      <div className={styles.song_editor_tools}>
        {errors}
        {this.textInput("Title", "title", {
          required: true
        })}
        {this.textInput("Source", "source")}
        {this.textInput("Artist", "artist")}
        {this.textInput("Album", "album")}

        <div className={styles.form_tools}>
          {saveButton}
          {" "}
          {songVisibility}
          {" "}
          {moreButton}
        </div>
      </div>

    </JsonForm>

    <div className={styles.local_song_bank}>
      <input
        type="file"
        accept=".ly,.txt,.json"
        ref={this.fileInputRef}
        style={{display: "none"}}
        onChange={this.onFileChosen.bind(this)}
      />
      <input
        type="file"
        accept=".ly"
        multiple
        ref={this.batchFileInputRef}
        style={{display: "none"}}
        onChange={this.onBatchFilesChosen.bind(this)}
      />

      {this.state.sourceFileName ? <div className={styles.source_file_notice}>
        Editando <strong>{this.state.sourceFileName}</strong> — reenviar pro
        GitHub vai sobrescrever esse mesmo arquivo.
        {" "}
        <button type="button" onClick={() => this.setState({sourceFileName: null})}>
          Salvar como nova música em vez disso
        </button>
      </div> : null}

      <div className={styles.form_tools}>
        <button type="button" onClick={this.saveLocalCopy.bind(this)}>
          Salvar no dispositivo
        </button>
        {" "}
        <button type="button" onClick={this.openFilePicker.bind(this)}>
          Abrir arquivo (.ly / .json)
        </button>
        {" "}
        <button type="button" disabled={this.state.batchImporting} onClick={this.openBatchFilePicker.bind(this)}>
          {this.state.batchImporting ? "Importando..." : "Importar em lote (vários .ly)"}
        </button>
        {" "}
        <button type="button" onClick={this.toggleLocalSongsList.bind(this)}>
          {this.state.showLocalSongs ? "Fechar lista" : `Músicas salvas (${this.state.localSongs.length})`}
        </button>
        {" "}
        <button type="button" onClick={this.exportToFile.bind(this)}>
          Exportar .ly
        </button>
        {" "}
        <button type="button" onClick={this.shareCurrentSong.bind(this)}>
          Compartilhar esta música
        </button>
        {" "}
        <button type="button" onClick={this.shareAllLocalSongs.bind(this)}>
          Compartilhar banco inteiro
        </button>
      </div>

      {this.state.localSaveMessage ? <div className={styles.local_save_message}>{this.state.localSaveMessage}</div> : null}

      {this.state.batchImportStatus.length ? <ul className={styles.batch_import_list}>
        {this.state.batchImportStatus.map(s =>
          <li key={s.name}>
            <strong>{s.name}</strong> — {s.status}
          </li>
        )}
      </ul> : null}

      {this.state.showLocalSongs ? <ul className={styles.local_song_list}>
        {this.state.localSongs.length ? this.state.localSongs.map((s, idx) =>
          <li
            key={s.id}
            className={classNames(styles.local_song_item, {
              [styles.local_song_item_active]: s.id == this.state.localSongId
            })}
            onClick={() => this.openLocalSongById(s.id)}>
            <span className={styles.local_song_title}>{idx + 1}. {s.title || "Untitled"}</span>
            <button type="button" onClick={(e) => this.deleteLocalSongById(s.id, e)}>Apagar</button>
          </li>
        ) : <li className={styles.local_song_empty}>Nenhuma música salva no dispositivo ainda.</li>}
      </ul> : null}

      <div className={styles.github_panel}>
        <button type="button" onClick={this.toggleGithubPanel.bind(this)}>
          {this.state.showGithubPanel ? "Fechar GitHub" : "Enviar pro GitHub"}
        </button>

        {this.state.showGithubPanel ? <div className={styles.github_fields}>
          <p className={styles.github_warning}>
            O token fica salvo só neste dispositivo e é usado apenas para
            falar direto com a api.github.com. Use um token "fine-grained"
            com acesso limitado a este repositório e permissão
            "Contents: Read and write" — nunca um token com acesso total à
            sua conta.
          </p>

          <label>
            Usuário/organização do GitHub
            <input type="text" value={this.state.owner || ""}
              onChange={e => this.updateGithubField("owner", e.target.value)} />
          </label>

          <label>
            Repositório
            <input type="text" value={this.state.repo || ""}
              onChange={e => this.updateGithubField("repo", e.target.value)} />
          </label>

          <label>
            Pasta de destino
            <input type="text" value={this.state.folder || ""}
              onChange={e => this.updateGithubField("folder", e.target.value)} />
          </label>

          <label>
            Token de acesso (fine-grained, só "Contents: Read and write")
            <input type="password" value={this.state.token || ""}
              onChange={e => this.updateGithubField("token", e.target.value)} />
          </label>

          <button type="button" disabled={this.state.githubBusy} onClick={this.publishToGithub.bind(this)}>
            {this.state.githubBusy ? "Enviando..." : "Enviar esta música"}
          </button>

          {this.state.githubMessage ? <div className={styles.github_message}>{this.state.githubMessage}</div> : null}
        </div> : null}
      </div>

      <div className={styles.contributor_credits}>
        Notação LilyPond, nomes em português, cores por nota, banco local e
        modo de acompanhamento MIDI por <strong>Léo Café</strong> · implementação
        técnica por <strong>Claude (Anthropic)</strong> · projeto original por{" "}
        <a href="https://github.com/leafo/sightreading.training" target="_blank" rel="noreferrer">
          Leaf Corcoran
        </a>
      </div>
    </div>
    </React.Fragment>
  }

  textInput(title, field, opts={}) {
    if (!this.fieldUpdaters[field]) {
      this.fieldUpdaters[field] = e => {
        let update = {
          [field]: e.target.value
        }
        this.setState(update)
        this.updateWip(update)
        if (field == "title") {
          this.autoSaveLocal(update)
        }
      }
    }

    return <TextInputRow
      required={opts.required}
      disabled={this.state.loading}
      onChange={this.fieldUpdaters[field]}
      value={this.state[field] || ""}
      name={`song[${field}]`}
      >{title}</TextInputRow>
  }

  // destaca (seleciona) um trecho do código, chamado ao clicar numa nota
  // na pauta com o editor aberto
  highlightRange(start, end) {
    let input = this.codeInputRef.current
    if (!input || start == null) {
      return
    }

    input.focus()
    input.setSelectionRange(start, end != null ? end : start)

    // rola o textarea pra deixar a seleção visível, caso esteja fora da
    // área visível no momento
    let before = input.value.slice(0, start)
    let lineNumber = before.split("\n").length
    let totalLines = input.value.split("\n").length
    let lineHeight = input.scrollHeight / Math.max(totalLines, 1)
    let targetScroll = lineHeight * (lineNumber - 1) - input.clientHeight / 2
    input.scrollTop = Math.max(0, targetScroll)
  }

  pressNote(note) {
    let input = this.codeInputRef.current
    if (!input) {
      return
    }

    let code = this.state.code

    let selectionStart = input.selectionStart
    let selectionEnd = input.selectionEnd

    let before = code.substring(0, input.selectionStart)
    let after = code.substring(input.selectionEnd, code.length)

    let keySignature = KeySignature.forCount(0)
    if (this.props.songNotes && this.props.songNotes.metadata) {
      keySignature = KeySignature.forCount(this.props.songNotes.metadata.keySignature || 0)
    }

    let [, noteName, , octave] = note.match(/([A-G])(#|b)?(\d+)/)

    let accidental = ""
    switch (keySignature.accidentalsForNote(note)) {
      case 0: {
        accidental = "="
        break
      }
      case 1: {
        accidental = "-"
        break
      }
      case -1: {
        accidental = "+"
        break
      }
    }

    let noteCode = noteName.toLowerCase() + accidental + octave

    if (before && !before.match(/\s$/)) {
      noteCode = " " + noteCode
    }

    if (after && !after.match(/^\s/)) {
      noteCode = noteCode + " "
    }

    this.updateCode(before + noteCode + after, () => {
      // make the modification using execCommand to ensure undo works
      input.value = code
      input.selectionStart = selectionStart
      input.selectionEnd = selectionEnd
      input.focus()
      document.execCommand("insertText", false, noteCode)
    })
  }
}
