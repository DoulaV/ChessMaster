import { useNavigate } from 'react-router';
import { Chessboard } from 'react-chessboard';
import { useSlot } from '../../progress/store';
import { studiesSlot } from '../../progress/slots';
import { Button, Card } from '../../ui/kit';
import { analysisPath } from './handoff';

export function StudiesPage() {
  const [studies, update] = useSlot(studiesSlot);
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">My studies</h1>
      {!studies.length && (
        <Card>
          <p className="text-sm">
            Nothing saved yet. In the Analysis board, tap <b>Save to studies</b> to keep a position or game here.
          </p>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {studies.map((s) => (
          <Card key={s.id}>
            <div className="pointer-events-none mb-2">
              <Chessboard options={{ position: s.tree.nodes[s.current]?.fen, boardOrientation: s.orientation, allowDragging: false, showNotation: false }} />
            </div>
            <p className="font-semibold">{s.title}</p>
            <p className="mb-2 text-xs text-cm-faint">{new Date(s.savedAt).toLocaleString()}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate(analysisPath({ tree: s.tree, current: s.current, orientation: s.orientation, title: s.title }))}
              >
                Open
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete "${s.title}"?`)) update((all) => all.filter((x) => x.id !== s.id));
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
