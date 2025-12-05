import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { GameProvider } from './context';
import { GameSelector } from './GameSelector';
import { GameInfo } from './config';
import { DS1App } from '../apps/ds1/DS1App';
import { MetaTags } from './MetaTags';
import { ErrorPage } from './ErrorPage';

// Wrapper to use ErrorPage with React Router hooks
const ErrorPageWrapper: React.FC<{ errorType?: 'notFound' | 'redirect' | 'general' }> = ({ errorType }) => {
  const location = useLocation();
  return <ErrorPage errorType={errorType} currentPath={location.pathname} />;
};

const GameSelectorWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleGameSelect = (game: GameInfo) => {
    navigate(`/${game.id}`);
  };

  return <GameSelector onGameSelect={handleGameSelect} />;
};

const DS1AppWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleHome = () => {
    navigate('/');
  };

  return <DS1App onHome={handleHome} />;
};

const ComingSoon: React.FC<{ title: string; gameId: string }> = ({ title, gameId }) => {
  const navigate = useNavigate();

  // Meta tags based on game
  const metaData = {
    ds3: {
      title: 'Dark Souls 3 Save Editor - Coming Soon | DS3 Editor',
      description: 'Dark Souls 3 save editor coming soon! Edit DS3 character stats, inventory, weapons, armor, and more. Free online browser-based editor.',
      keywords: 'dark souls 3 save editor, ds3 save editor, dark souls 3 editor, ds3 character editor, dark souls 3 stats editor, ds3 inventory editor, dark souls iii save editor, ds3 online editor',
      ogTitle: 'Dark Souls 3 Save Editor - Coming Soon',
      ogDescription: 'Dark Souls 3 save editor is coming soon! Stay tuned for a free online DS3 save editor.',
      canonical: 'https://dsrsaveeditor.pages.dev/ds3'
    },
    eldenring: {
      title: 'Elden Ring Save Editor - Coming Soon | ER Editor',
      description: 'Elden Ring save editor coming soon! Edit ER character stats, inventory, weapons, armor, runes, and more. Free online browser-based editor.',
      keywords: 'elden ring save editor, er save editor, elden ring editor, elden ring character editor, elden ring stats editor, elden ring inventory editor, elden ring online editor, elden ring runes editor',
      ogTitle: 'Elden Ring Save Editor - Coming Soon',
      ogDescription: 'Elden Ring save editor is coming soon! Stay tuned for a free online Elden Ring save editor.',
      canonical: 'https://dsrsaveeditor.pages.dev/eldenring'
    }
  };

  const meta = metaData[gameId as keyof typeof metaData] || metaData.ds3;

  return (
    <>
      <MetaTags {...meta} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: '#fff',
        gap: '2rem'
      }}>
        <h1>{title} - Coming Soon</h1>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            background: '#ff6b35',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Game Selection
        </button>
      </div>
    </>
  );
};

export const Router: React.FC = () => {
  return (
    <GameProvider>
      <Routes>
        {/* Home routes - both / and /home go to game selector */}
        <Route path="/" element={<GameSelectorWrapper />} />
        <Route path="/home" element={<Navigate to="/" replace />} />

        {/* Game routes */}
        <Route path="/ds1" element={<DS1AppWrapper />} />
        <Route path="/ds3" element={<ComingSoon title="Dark Souls 3" gameId="ds3" />} />
        <Route path="/eldenring" element={<ComingSoon title="Elden Ring" gameId="eldenring" />} />

        {/* 404 - catch all unknown routes */}
        <Route path="*" element={<ErrorPageWrapper errorType="notFound" />} />
      </Routes>
    </GameProvider>
  );
};
