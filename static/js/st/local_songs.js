// Armazena músicas (código LilyPond) direto no navegador/dispositivo,
// sem depender de um servidor -- útil especialmente no modo frontend-only,
// onde o botão de salvar normal (que envia pro backend) não funciona.

import {readConfig, writeConfig} from "st/config"

const STORAGE_KEY = "local_songs"

function readAll() {
  return readConfig(STORAGE_KEY, {}) || {}
}

function writeAll(all) {
  writeConfig(STORAGE_KEY, all)
}

function makeId() {
  return `local-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

// devolve a lista de músicas salvas, em ordem alfabética pelo título
export function listLocalSongs() {
  let all = readAll()
  return Object.values(all).sort((a, b) =>
    (a.title || "").localeCompare(b.title || "", "pt-BR", {sensitivity: "base"})
  )
}

export function getLocalSong(id) {
  let all = readAll()
  return all[id]
}

// cria (sem id) ou atualiza (com id) uma música local; devolve o registro salvo
export function saveLocalSong({id, title, code}) {
  let all = readAll()
  let finalId = id || makeId()

  let entry = {
    id: finalId,
    title: title || "Untitled",
    code: code || "",
    updatedAt: Date.now(),
  }

  all[finalId] = entry
  writeAll(all)
  return entry
}

export function deleteLocalSong(id) {
  let all = readAll()
  delete all[id]
  writeAll(all)
}
