export interface LivePlace {
  key: string
  folder: string
  name: string
  hosting: boolean
}

export const projectPlace = (folder: string): string => `project:${folder}`

export const joinPlace = (link: string): string => `join:${link}`
