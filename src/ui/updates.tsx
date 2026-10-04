import { useEffect, useState } from 'react';
import { api } from '../shared/bridge';
import type { UpdateStatus } from '../shared/contracts';

export function Updates({ automatic, onAutomatic }: { automatic: boolean; onAutomatic: () => void }) {
  const [state, setState] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    const update = (value: UpdateStatus) => { if (active) setState(value); };
    const detach = api.onUpdateStatus(update);
    void api.getUpdateStatus().then(update).catch(() => { if (active) setError('Update status is unavailable.'); });
    return () => { active = false; detach(); };
  }, []);
  const run = async (action: () => Promise<UpdateStatus>) => {
    setPending(true); setError('');
    try { setState(await action()); } catch (failure) { setError(failure instanceof Error ? failure.message : 'The update could not complete.'); }
    finally { setPending(false); }
  };
  const enabled = state && state.capability !== 'unavailable';
  const busy = pending || state?.status === 'checking' || state?.status === 'downloading' || state?.status === 'installing';
  return <section className="update-options" aria-label="Software updates">
    <h3>Software updates</h3>
    <p role="status">{state?.message ?? 'Loading update status…'}</p>
    {state?.status === 'downloading' && <progress aria-label="Update download progress" max={100} value={state.percent ?? 0} />}
    <label className="update-automatic"><input type="checkbox" checked={automatic} disabled={!enabled} onChange={onAutomatic} /> Automatically check{state?.capability === 'automatic' ? ' and download updates' : ' for updates'}</label>
    {state?.capability === 'automatic' && <p className="preference-description">Checks every four hours. Installation waits for Install and restart.</p>}
    {state?.capability === 'manual' && <p className="preference-description">This package uses manual installation. Download and install the new release when an update is available.</p>}
    <div className="dialog-actions-inline">
      <button className="dialog-button" disabled={!enabled || busy || state?.status === 'downloaded'} onClick={() => void run(api.checkForUpdates)}>Check for updates</button>
      {state?.status === 'available' && <button className="dialog-button orange" disabled={pending} onClick={() => state.capability === 'automatic' ? void run(api.downloadUpdate) : void api.openUpdatePage().catch(() => setError('The downloads page could not open.'))}>{state.capability === 'automatic' ? 'Download update' : 'Open downloads'}</button>}
      {(state?.status === 'downloaded' || state?.status === 'installing') && <button className="dialog-button orange" disabled={pending || state.status === 'installing'} onClick={() => void run(api.installUpdate)}>Install and restart</button>}
    </div>
    {state?.checkedAt && <p className="preference-description">Last checked: {new Date(state.checkedAt).toLocaleString()}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
