import { Check, MapPin, Phone, X } from 'lucide-react'
import { Minimap } from '../maps/Minimap.jsx'
import { formatDistance, remainingDistance } from '../taxi/dispatch.js'

const phaseCopy = {
  available: 'New ride request',
  pickup: 'Drive to pickup',
  trip: 'Passenger on board',
  completed: 'Ride completed',
}

export function DispatchPhone({
  dispatch, telemetry, destination, open, onClose, onAccept, onCancel, onSkip, onNext,
}) {
  const { ticket, status } = dispatch
  const remaining = remainingDistance(dispatch, telemetry)
  return (
    <aside className={`dispatch-phone ${open ? 'is-open' : ''}`} aria-label="Taxi dispatch phone" aria-hidden={!open}>
      <div className="phone-speaker" aria-hidden="true" />
      <div className="phone-header">
        <div><span className="phone-app-name"><Phone size={14} /> METRO DISPATCH</span><strong>{phaseCopy[status]}</strong></div>
        <button type="button" className="phone-close" onClick={onClose} aria-label="Close dispatch phone"><X size={18} /></button>
      </div>
      <div className="phone-screen-body">
        <div className="phone-ticket-id"><span>RIDE {ticket.id}</span><span>{status === 'available' ? 'INCOMING' : status.toUpperCase()}</span></div>
        <Minimap variant="phone" telemetry={telemetry} ticket={ticket} status={status} destination={destination} />
        <div className="phone-passenger"><span className="passenger-avatar">{ticket.passenger[0]}</span><div><small>PASSENGER</small><strong>{ticket.passenger}</strong></div><span className="fare-pill">RM {ticket.fare.toFixed(2)}</span></div>
        <div className="phone-route">
          <div><i className="route-dot pickup" /><span><small>PICKUP · {ticket.pickup.district}</small><strong>{ticket.pickup.name}</strong></span></div>
          <div><i className="route-dot dropoff" /><span><small>DROP-OFF · {ticket.dropoff.district}</small><strong>{ticket.dropoff.name}</strong></span></div>
        </div>
        {status === 'available' && <p className="phone-guidance">Accept this fare, drive to the pickup marker, then stop to board.</p>}
        {status === 'pickup' && <p className="phone-guidance">{remaining > 0 ? `${formatDistance(remaining)} to pickup` : 'Stop safely to pick up your passenger.'} Boarding starts automatically below 6 km/h.</p>}
        {status === 'trip' && <p className="phone-guidance">{remaining > 0 ? `${formatDistance(remaining)} to drop-off` : 'Stop safely to finish the ride.'} Drop-off completes automatically below 6 km/h.</p>}
        {status === 'completed' && <p className="phone-guidance">Fare paid. Ready for another ride?</p>}
      </div>
      <div className="phone-footer">
        {status === 'available' && <><button type="button" className="phone-secondary" onClick={onSkip}>Skip</button><button type="button" className="phone-primary" onClick={onAccept}><Check size={16} /> Accept ride</button></>}
        {status === 'completed' && <button type="button" className="phone-primary full" onClick={onNext}>Find next ride</button>}
        {(status === 'pickup' || status === 'trip') && (
          <div className="phone-active-row">
            <button type="button" className="phone-secondary" onClick={onCancel}>
              <X size={14} /> Cancel
            </button>
            <div className="phone-active-note"><MapPin size={15} /> Follow the map and stop at the marker</div>
          </div>
        )}
      </div>
    </aside>
  )
}
