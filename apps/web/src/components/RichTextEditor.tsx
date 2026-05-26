import { useEffect, useRef, useState } from 'react'

import { ModalDialog } from './ModalDialog'

const toolbarActions = [
  { label: 'Título', command: 'formatBlock', value: '<h2>' },
  { label: 'Subtítulo', command: 'formatBlock', value: '<h3>' },
  { label: 'Parágrafo', command: 'formatBlock', value: '<p>' },
  { label: 'Negrito', command: 'bold' },
  { label: 'Itálico', command: 'italic' },
  { label: 'Sublinhado', command: 'underline' },
  { label: 'Lista', command: 'insertUnorderedList' },
] as const

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [assetModalMode, setAssetModalMode] = useState<'link' | 'image' | null>(null)
  const [assetUrl, setAssetUrl] = useState('')

  useEffect(() => {
    if (!editorRef.current) {
      return
    }

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    onChange(editorRef.current?.innerHTML || '')
  }

  function insertLink() {
    setAssetUrl('')
    setAssetModalMode('link')
  }

  function insertImage() {
    setAssetUrl('')
    setAssetModalMode('image')
  }

  function handleConfirmAsset() {
    if (!assetUrl.trim()) {
      return
    }

    runCommand(assetModalMode === 'image' ? 'insertImage' : 'createLink', assetUrl.trim())
    setAssetModalMode(null)
    setAssetUrl('')
  }

  return (
    <>
      <div className="rich-editor">
        <div className="rich-editor__toolbar">
          {toolbarActions.map((action) => (
            <button
              key={`${action.command}-${action.label}`}
              type="button"
              className="ghost-button rich-editor__tool"
              onClick={() => runCommand(action.command, 'value' in action ? action.value : undefined)}
            >
              {action.label}
            </button>
          ))}
          <button type="button" className="ghost-button rich-editor__tool" onClick={insertLink}>
            Link
          </button>
          <button type="button" className="ghost-button rich-editor__tool" onClick={insertImage}>
            Imagem
          </button>
        </div>

        <div
          ref={editorRef}
          className="rich-editor__surface"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChange((event.currentTarget as HTMLDivElement).innerHTML)}
          data-placeholder="Escreva o conteúdo completo da página do evento aqui. Você pode inserir títulos, listas, links e imagens por URL."
        />
      </div>

      <ModalDialog
        isOpen={Boolean(assetModalMode)}
        title={assetModalMode === 'image' ? 'Inserir imagem por URL' : 'Inserir link'}
        description={assetModalMode === 'image'
          ? 'Cole a URL pública da imagem que deve entrar no conteúdo.'
          : 'Cole a URL que deve ser aplicada ao texto selecionado.'}
        confirmLabel={assetModalMode === 'image' ? 'Inserir imagem' : 'Inserir link'}
        cancelLabel="Cancelar"
        onClose={() => setAssetModalMode(null)}
        onConfirm={handleConfirmAsset}
        isConfirmDisabled={!assetUrl.trim()}
      >
        <label>
          <span>URL</span>
          <input value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} placeholder="https://..." autoFocus />
        </label>
      </ModalDialog>
    </>
  )
}