import { useState } from 'react';
import { useSlot, exportAll } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { Button, Card, Segmented } from '../../ui/kit';

export function SettingsPage() {
  const [s, update] = useSlot(settingsSlot);
  const [tokenDraft, setTokenDraft] = useState('');
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => update((o) => ({ ...o, [k]: v }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card title="About you">
        <label className="block text-sm font-medium">Your Chess.com rapid rating</label>
        <input
          type="number"
          inputMode="numeric"
          min={100}
          max={3000}
          className="mt-1 w-32 rounded border p-2"
          value={s.rating}
          onChange={(e) => set('rating', Math.max(100, Math.min(3000, Number(e.target.value) || 800)))}
        />
        <p className="mt-1 text-xs text-cm-faint">Used to set opening depth, puzzle level and bot suggestions.</p>
        <label className="mt-4 block text-sm font-medium">Chess.com username</label>
        <input className="mt-1 w-full rounded border p-2" value={s.chesscomUser} onChange={(e) => set('chesscomUser', e.target.value.trim())} autoCapitalize="none" />
        <label className="mt-3 block text-sm font-medium">Lichess username (optional)</label>
        <input className="mt-1 w-full rounded border p-2" value={s.lichessUser} onChange={(e) => set('lichessUser', e.target.value.trim())} autoCapitalize="none" />
      </Card>

      <Card title="Board colors">
        <Segmented
          value={s.boardTheme}
          onChange={(v) => set('boardTheme', v)}
          options={[
            { value: 'green', label: 'Green' },
            { value: 'brown', label: 'Brown' },
            { value: 'blue', label: 'Blue' },
          ]}
        />
      </Card>

      <Card title="Lichess explorer stats (optional)">
        <p className="mb-2 text-sm">
          This shows how often each opening move is played by people at your level. Lichess asks for a free token for it.
          Everything else in the app works without it.
        </p>
        <ol className="mb-3 list-decimal space-y-1 ps-5 text-sm">
          <li>Sign in at lichess.org (a free account is fine).</li>
          <li>
            Open{' '}
            <a className="underline" href="https://lichess.org/account/oauth/token/create?description=ChessMaster" target="_blank" rel="noreferrer">
              this page
            </a>{' '}
            (Preferences, then API access tokens).
          </li>
          <li>Leave every box unticked. Tap <b>Create</b>.</li>
          <li>Copy the token and paste it below. It stays only on this device.</li>
        </ol>
        {s.lichessToken ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-cm-green-light">✅ Token saved on this device.</span>
            <Button size="sm" variant="ghost" onClick={() => set('lichessToken', '')}>Remove</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              className="w-full rounded border p-2"
              placeholder="lip_..."
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              autoComplete="off"
            />
            <Button
              variant="primary"
              onClick={() => {
                set('lichessToken', tokenDraft.trim());
                setTokenDraft('');
              }}
            >
              Save
            </Button>
          </div>
        )}
      </Card>

      <Card title="Backup">
        <p className="mb-2 text-sm">Your progress is saved in this browser. Download a backup file now and then.</p>
        <Button
          size="sm"
          onClick={() => {
            const data = exportAll();
            // Never put the Lichess token in a file that might get shared.
            const st = data['cm:settings'] as { data: Record<string, unknown> } | undefined;
            if (st) st.data = { ...st.data, lichessToken: '' };
            const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `chessmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}
        >
          Download backup
        </Button>
      </Card>
    </div>
  );
}
