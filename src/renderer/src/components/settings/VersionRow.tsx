import { useEffect, useState } from 'react'
import { Fact, Row } from './parts'

export default function VersionRow() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    let live = true
    void window.crew.appVersion().then(next => live && setVersion(next))
    return () => {
      live = false
    }
  }, [])

  if (!version) return null

  return (
    <Row label="Version">
      <Fact>{version}</Fact>
    </Row>
  )
}
