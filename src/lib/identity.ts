import { nanoid } from 'nanoid'

const ADJ = ['Amber', 'Cobalt', 'Mossy', 'Velvet', 'Copper', 'Ivory', 'Indigo', 'Scarlet', 'Dusky', 'Golden']
const ANIMAL = ['Fox', 'Heron', 'Otter', 'Lynx', 'Moth', 'Wren', 'Badger', 'Ibis', 'Newt', 'Hare']

function randomName() {
  return `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${ANIMAL[Math.floor(Math.random() * ANIMAL.length)]}`
}

export function getIdentity(): { clientId: string; name: string } {
  let clientId = localStorage.getItem('doop:clientId')
  if (!clientId) {
    clientId = nanoid(12)
    localStorage.setItem('doop:clientId', clientId)
  }
  let name = localStorage.getItem('doop:name')
  if (!name) {
    name = randomName()
    localStorage.setItem('doop:name', name)
  }
  return { clientId, name }
}

export function setName(name: string) {
  localStorage.setItem('doop:name', name)
}
