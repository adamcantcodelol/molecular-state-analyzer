/** Read a File as UTF-8 text without modifying its contents. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    }
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsText(file)
  })
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
