import { FlaskConical } from 'lucide-react'

/** גרסת ניסיון לצפייה: המידע נשמר רק בזיכרון, וקבצים לא נשמרים */
export const PROTO = import.meta.env.VITE_PROTO === '1'

/** פס עליון בגרסת הניסיון */
export function ProtoBar() {
  return (
    <div style={{ background: '#FFF3DC', color: '#6B4100', borderBottom: '1px solid #F1DDB4' }}>
      <div style={{ maxWidth: 1184, margin: '0 auto', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        <FlaskConical size={18} style={{ flex: '0 0 18px' }} />
        <span>גרסת ניסיון. המידע נמחק ברענון הדף, וקבצים לא נשמרים באמת.</span>
      </div>
    </div>
  )
}
