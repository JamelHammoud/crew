import { Action, Row } from './parts'

const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'

export default function CreditsRow() {
  return (
    <Row
      label="Emoji artwork"
      line={
        <span className="select-text">
          Twemoji, by Twitter and its contributors, under Creative Commons Attribution 4.0.
        </span>
      }
    >
      <Action label="View license" onClick={() => void window.crew.openExternal(LICENSE_URL)} />
    </Row>
  )
}
