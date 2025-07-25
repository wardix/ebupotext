type EbupotExtractedData = {
  h1: string
  b1: string
  b2: string
  b7: string[]
  b8: string[]
  c1: string
  c3?: string
  c4?: string
  dpp?: string
  pph?: string
}

export function getEbupotFormatedSignature(data: string) {
  if (data.indexOf('FORMULIR BPBS\nH.1\nH.2\nH.3') > -1) {
    if (data.indexOf('A.3  NITKU') > -1) {
      return 'E'
    }
    return 'A'
  }
  if (data.indexOf('FORMULIR BPBS\nBukti Pemotongan') > -1) {
    return 'B'
  }
  if (data.indexOf('FORMULIR BPBS\nH.1\nNOMOR') > -1) {
    if (data.indexOf('A.3  NITKU') > -1) {
      return 'D'
    }
    return 'C'
  }
  if (data.indexOf('UNIFIKASI BERFORMAT STANDAR') > -1) {
    return 'F'
  }
  if (data.trim().length == 0) {
    return 'Z'
  }
  return 'U'
}

function extractAFormatedEbupot(data: string) {
  const p = data.indexOf('Dokumen Referensi')
  const s = data.substring(p)
  const ret: EbupotExtractedData = {
    h1: '',
    b1: '',
    b2: '',
    b7: [],
    b8: [],
    c1: '',
    c3: '',
  }

  let buffer = ''
  let state = 0
  for (const line of s.split(/\n/)) {
    if (state == 0) {
      state = 1
      continue
    }
    if (state == 1) {
      ret.b7.push(line)
      state = 2
      continue
    }
    if (state == 2) {
      if (['Nama Dokumen', 'Tanggal', 'dd', 'mm', 'yyyy'].includes(line)) {
        continue
      }
      if (line === 'B.8') {
        state = 3
        if (buffer === '') {
          ret.b7.pop()
          continue
        }
        const [docName, docDate] = splitDocDate(buffer)
        ret.b7.push(docName.startsWith('Tanggal') ? docName.substring(8) : docName)
        ret.b7.push(docDate)
        buffer = ''
        continue
      }
      buffer = `${buffer}${line}`
      continue
    }
    if (state <= 4) { // skip next two lines
      state++
      continue
    }
    if (state == 5) {
      if (['Tanggal', 'dd', 'mm', 'yyyy'].includes(line)) {
        continue
      }
      if (line === 'B.9') {
        state = 6
        if (buffer === '') {
          continue
        }
        const [docName, docDate] = splitDocDate(buffer)
        ret.b8.push(docName.startsWith('Tanggal') ? docName.substring(8) : docName)
        ret.b8.push(docDate)
        buffer = ''
        continue
      }
      buffer = `${buffer}${line}`
      continue
    }
    if (state == 6) {
      if (line === 'C.1') {
        state = 7
      }
      continue
    }
    if (state == 7) {
      if (line === ':NPWP') {
        state = 8
      }
      continue
    }
    if (state == 8) {
      if (line === 'Nama Wajib PajakC.2:') {
        state = 9
        ret.c1 = buffer
        buffer = ''
        continue
      }
      buffer = `${buffer}${line}`
      continue
    }
    if (state == 9) {
      if (line === 'mmyyyy') {
        state = 10
      }
      continue
    }
    if (state == 10) {
      if (line === 'C.4') {
        state = 11
        ret.c3 = ddmmyyyyToIso(buffer)
        buffer = ''
        continue
      }
      buffer = `${buffer}${line}`
      continue
    }
    if (state == 11) {
      if (line.indexOf('Bukti Pemotongan ini.') > -1) {
        state = 12
      }
      continue
    }
    if (state == 12) {
      ret.h1 = line
      state = 13
      continue
    }
    if (state == 13) {
      if (line.length > 4) {
        state = 14
        ret.b1 = line
      }
      continue
    }
    if (state == 14) {
      ret.b2 = line
      break
    }
  }
  return ret
}

function extractBFormatedEbupot(data: string) {
  const p = data.indexOf('PPh Tidak Final')
  const s = data.substring(p)
  const ret: EbupotExtractedData = {
    h1: '',
    b1: '',
    b2: '',
    b7: [],
    b8: [],
    c1: '',
    c3: '',
  }

  let state = 0
  for (const line of s.split(/\n/)) {
    if (state < 2) {
      state += 1
      continue
    }
    if (state == 2) {
      ret.h1 = line
      state = 3
      continue
    }
    if (state == 3) {
      if (line === 'B.1B.2B.3B.4B.5B.6') {
        state = 4
      }
      continue
    }
    if (state == 4) {
      state = 5
      ret.b1 = line.slice(-11, -10) === ',' ? line.slice(-7) : line.slice(-6)
      const p = line.indexOf('-')
      ret.b2 = line.substring(p - 2, p + 7)
      continue
    }
    if (state == 5) {
      if (line === 'ddmmyyyy') {
        state = 6
      }
      continue
    }
    if (state == 6) {
      if (line === 'B.8') {
        state = 8
        ret.b7.push('', '', '')
        continue
      }
      state = 7
      ret.b7.push(line)
      continue
    }
    if (state == 7) {
      state = 8
      const randDate = line.slice(-8)
      const date = [
        randDate[1],
        randDate[2],
        randDate[7],
        randDate[5],
        '-',
        randDate[3],
        randDate[4],
        '-',
        randDate[0],
        randDate[6],
      ]
      ret.b7.push(line.slice(0, -8))
      ret.b7.push(date.join(''))
      continue
    }
    if (state == 8) {
      // FIXME
      state = 9
      continue
    }
    if (state == 9) {
      if (line.startsWith('C. IDENTITAS PEMOTONG')) {
        state = 10
      }
      continue
    }
    if (state == 10) {
      state = 11
      const npwp = [
        line[7],
        line[11],
        line[14],
        line[9],
        line[3],
        line[5],
        line[12],
        line[13],
        line[1],
        line[6],
        line[2],
        line[10],
        line[0],
        line[8],
        line[4],
      ]
      ret.c1 = npwp.join('')
      continue
    }
    if (state == 11) {
      if (line == 'C.2Nama Wajib Pajak:') {
        state = 12
      }
      continue
    }
    if (state == 12) {
      const date = [
        line[1],
        line[7],
        line[2],
        line[4],
        '-',
        line[0],
        line[6],
        '-',
        line[5],
        line[3],
      ]
      ret.c3 = date.join('')
      break
    }
  }
  return ret
}

function extractCFormatedEbupot(data: string) {
  const p = data.indexOf('Bukti Pemotongan ini.')
  const s = data.substring(p)
  const bufferLines = []
  let b7 = false
  const ret: EbupotExtractedData = {
    h1: '',
    b1: '',
    b2: '',
    b7: [],
    b8: [],
    c1: '',
    c3: '',
  }

  let state = 0
  for (const line of s.split(/\n/)) {
    if (state == 0) {
      state = 1
      continue
    }
    if (state == 1) {
      ret.h1 = line.replace(/\s/g, '')
      state = 2
      continue
    }
    if (state < 6) {
      state += 1
      continue
    }
    if (state == 6) {
      state = 7
      const p = line.indexOf('-')
      ret.b1 = line.substring(0, p + 5)
      ret.b2 = line.substring(p + 5, p + 14)
      continue
    }
    if (state == 7) {
      state = 8
      continue
    }
    if (state == 8) {
      state = 9
      bufferLines.push(line)
      continue
    }
    if (state == 9) {
      const npwp = line.replace(/\s/g, '')
      if (/^\d+$/.test(npwp) && npwp.length == 15) {
        state = 11
        ret.c1 = npwp
        continue
      }
      state = 10
      bufferLines.push(line)
      b7 = true
      continue
    }
    if (state == 10) {
      state = 11
      ret.c1 = line.replace(/\s/g, '')
      continue
    }
    if (state == 11) {
      state = 12
      if (b7) {
        ret.b7.push(bufferLines[0])
        const [doc, date] = splitDocDate(bufferLines[1])
        ret.b7.push(doc, date)
        continue
      }
      const [doc, date] = splitDocDate(bufferLines[0])
      ret.b8.push(doc, date)
      continue
    }
    if (state == 12) {
      ret.c3 = ddmmyyyyToIso(line.replace(/\s/g, ''))
      break
    }
  }
  return ret
}

function extractDFormatedEbupot(data: string) {
  const p = data.indexOf('Bukti Pemotongan ini.')
  const s = data.substring(p)
  const bufferLines = []
  let b7 = false
  const ret: EbupotExtractedData = {
    h1: '',
    b1: '',
    b2: '',
    b7: [],
    b8: [],
    c1: '',
    c4: '',
  }

  let state = 0
  for (const line of s.split(/\n/)) {
    if (state == 0) {
      state = 1
      continue
    }
    if (state == 1) {
      ret.h1 = line.replace(/\s/g, '')
      state = 2
      continue
    }
    if (state < 7) {
      state += 1
      continue
    }
    if (state == 7) {
      state = 8
      const p = line.indexOf('-')
      ret.b1 = line.substring(0, p + 5)
      ret.b2 = line.substring(p + 5, p + 14)
      continue
    }
    if (state == 8) {
      state = 9
      continue
    }
    if (state == 9) {
      state = 10
      bufferLines.push(line)
      continue
    }
    if (state == 10) {
      const npwp = line.replace(/\s/g, '')
      if (/^\d+(\/\d+)?$/.test(npwp) && npwp.length >= 15) {
        state = 12
        ret.c1 = npwp
        continue
      }
      state = 11
      bufferLines.push(line)
      b7 = true
      continue
    }
    if (state == 11) {
      state = 12
      ret.c1 = line.replace(/\s/g, '')
      continue
    }
    if (state == 12) {
      state = 13
      if (b7) {
        ret.b7.push(bufferLines[0])
        const [doc, date] = splitDocDate(bufferLines[1])
        ret.b7.push(doc, date)
        continue
      }
      const [doc, date] = splitDocDate(bufferLines[0])
      ret.b8.push(doc, date)
      continue
    }
    if (state == 13) {
      state = 14
      continue
    }
    if (state == 14) {
      ret.c4 = ddmmyyyyToIso(line.replace(/\s/g, ''))
      break
    }
  }
  return ret
}

function extractEFormatedEbupot(data: string) {
  const p = data.indexOf('Dokumen Referensi')
  const s = data.substring(p)
  const ret: EbupotExtractedData = {
    h1: '',
    b1: '',
    b2: '',
    b7: [],
    b8: [],
    c1: '',
    c4: '',
  }

  let buffer = ''
  let state = 0
  for (const line of s.split(/\n/)) {
    if (state == 0) {
      state = 1
      continue
    }
    if (state == 1) {
      ret.b7.push(line)
      state = 2
      continue
    }
    if (state == 2) {
      if (line === 'ddmmyyyy') {
        state = 3
      }
      continue
    }
    if (state == 3) {
      state = 4
      if (line === '') {
        ret.b7.pop()
        continue
      }
      const docName = line.slice(0, -8)
      const docDate = line.slice(-8)
      ret.b7.push(docName)
      ret.b7.push(ddmmyyyyToIso(docDate))
      continue
    }
    if (state == 4) {
      if (line == 'Tanggal') {
        state = 5
      }
      continue
    }
    if (state == 5) {
      if (line === 'B.9') {
        state = 6
        if (buffer.length == 0) {
          continue
        }
        const docName = buffer.slice(0, -8)
        const docDate = buffer.slice(-8)
        ret.b8.push(docName, ddmmyyyyToIso(docDate))
        buffer = ''
        continue
      }
      buffer = `${buffer}${line}`
      continue
    }
    if (state == 6) {
      if (line === 'C.1') {
        state = 7
      }
      continue
    }
    if (state == 7) {
      if (line === 'NPWP') {
        state = 8
      }
      continue
    }
    if (state == 8) {
      state = 9
      ret.c1 = line.replace(/\s/g, '')
      continue
    }
    if (state == 9) {
      if (line === 'mmyyyy') {
        state = 10
      }
      continue
    }
    if (state == 10) {
      state = 11
      ret.c4 = ddmmyyyyToIso(line)
      continue
    }
    if (state == 11) {
      if (line.indexOf('Bukti Pemotongan ini.') > -1) {
        state = 12
      }
      continue
    }
    if (state == 12) {
      ret.h1 = line
      state = 13
      continue
    }
    if (state == 13) {
      if (line.length > 4) {
        state = 14
        ret.b1 = line
      }
      continue
    }
    if (state == 14) {
      ret.b2 = line
      break
    }
  }
  return ret
}

function extractFFormatedEbupot(data: string) {
  const monthMap: Record<string, string> = {
    Januari: '01',
    Februari: '02',
    Maret: '03',
    April: '04',
    Mei: '05',
    Juni: '06',
    Juli: '07',
    Agustus: '08',
    September: '09',
    Oktober: '10',
    November: '11',
    Desember: '12',
  }

  const p = data.indexOf('PEMUNGUTAN PPh\nPEMUNGUTAN\n')
  const s = data.substring(p)
  const ret: EbupotExtractedData = {
    h1: '',
    b1: '',
    b2: '',
    b7: [],
    b8: [],
    c1: '',
    c4: '',
    dpp: '',
    pph: ''
  }

  let state = 0
  for (const line of s.split(/\n/)) {
    if (state < 2) {
      state += 1
      continue
    }
    if (state == 2) {
      const p = line.indexOf('-')
      ret.h1 = line.substring(0, p - 2)
      ret.b1 = line.substring(p - 2, p + 5)
      state = 3
      continue
    }
    if (state == 3) {
      if (line === 'B.4B.5B.6B.7') {
        state = 4
      }
      continue
    }
    if (state == 4) {
      const match = line.match(/[0-9-]+/)
      ret.b2 = match ? match[0] : ''
      state = 5
      continue
    }
    if (state == 5) {
      if (line.startsWith('Jenis Dokumen:')) {
        ret.b7.push('')
        const p = line.indexOf('Tanggal')
        ret.b7.push(line.substring(14, p))
        const [dd, month, yyyy] = line.substring(p + 10).split(' ')
        const mm = monthMap[month]
        ret.b7.push(`${yyyy}-${mm}-${dd}`)
        state = 6
      }
      continue
    }
    if (state == 6) {
      if (line.startsWith('B.9 Nomor Dokumen')) {
        ret.b7[0] = line.substring(18)
        state = 7
      }
      continue
    }
    if (state == 7) {
      if (line.startsWith('C.1NPWP / NIK')) {
        ret.c1 = line.substring(14)
        state = 8
      }
      continue
    }
    if (state == 8) {
      if (line.startsWith('C.4TANGGAL')) {
        const [dd, month, yyyy] = line.substring(11).split(' ')
        const mm = monthMap[month]
        ret.c4 = `${yyyy}-${mm}-${dd}`
        break
      }
    }
  }
  return ret
}

export function extractEbupot(data: string, format: string) {
  switch (format) {
    case 'A':
      return extractAFormatedEbupot(data)
    case 'B':
      return extractBFormatedEbupot(data)
    case 'C':
      return extractCFormatedEbupot(data)
    case 'D':
      return extractDFormatedEbupot(data)
    case 'E':
      return extractEFormatedEbupot(data)
    case 'F':
      return extractFFormatedEbupot(data)
    default:
      return {}
  }
}

function ddmmyyyyToIso(ddmmyyyy: string) {
  const year = ddmmyyyy.substring(4, 8)
  const month = ddmmyyyy.substring(2, 4)
  const day = ddmmyyyy.substring(0, 2)
  return `${year}-${month}-${day}`
}

function splitDocDate(line: string) {
  let i = line.length - 1
  let date = []
  while (i > 0) {
    if (line[i] !== ' ') {
      date.push(line[i])
    }
    if (date.length >= 8) {
      break
    }
    i--
  }
  date.reverse()
  return [line.substring(0, i), ddmmyyyyToIso(date.join(''))]
}
