import { MetaTags } from './MetaTags';

interface ErrorPageProps {
  errorType?: 'notFound' | 'redirect' | 'general';
  message?: string;
  currentPath?: string;
}

// Standalone error page that doesn't require Router context
export const ErrorPage: React.FC<ErrorPageProps> = ({
  errorType = 'notFound',
  message,
  currentPath = window.location.pathname
}) => {
  const handleNavigate = (path: string) => {
    window.location.href = path;
  };

  const errorConfig = {
    notFound: {
      title: '404 - Page Not Found',
      heading: '404 - Page Not Found',
      description: `The page "${currentPath}" does not exist.`,
      suggestion: 'The page you are looking for might have been removed or is temporarily unavailable.'
    },
    redirect: {
      title: 'Redirect Error',
      heading: 'Too Many Redirects',
      description: 'The page encountered too many redirects.',
      suggestion: 'This might be a temporary issue. Please try clearing your browser cache and cookies, or contact support if the problem persists.'
    },
    general: {
      title: 'Error',
      heading: 'Something Went Wrong',
      description: message || 'An unexpected error occurred.',
      suggestion: 'Please try refreshing the page or return to the home page.'
    }
  };

  const config = errorConfig[errorType];

  return (
    <>
      <MetaTags
        title={config.title}
        description={config.description}
        keywords="error, page not found, 404"
        ogTitle={config.title}
        ogDescription={config.description}
        canonical={`https://dsrsaveeditor.pages.dev${currentPath}`}
      />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        color: '#fff',
        textAlign: 'center',
        gap: '1.5rem'
      }}>
        <div style={{
          fontSize: '6rem',
          fontWeight: 'bold',
          color: '#ff6b35',
          lineHeight: 1
        }}>
          {errorType === 'notFound' ? '404' : '!'}
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          margin: 0
        }}>
          {config.heading}
        </h1>

        <p style={{
          fontSize: '1.1rem',
          maxWidth: '600px',
          color: '#999',
          margin: 0
        }}>
          {config.description}
        </p>

        <p style={{
          fontSize: '0.95rem',
          maxWidth: '500px',
          color: '#666',
          margin: 0
        }}>
          {config.suggestion}
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: '1rem'
        }}>
          <button
            onClick={() => handleNavigate('/')}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              background: '#ff6b35',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#ff5722'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ff6b35'}
          >
            Go to Home
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              background: 'transparent',
              color: '#ff6b35',
              border: '2px solid #ff6b35',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ff6b35';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#ff6b35';
            }}
          >
            Refresh Page
          </button>
        </div>

        {errorType === 'redirect' && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '8px',
            maxWidth: '600px'
          }}>
            <p style={{
              fontSize: '0.9rem',
              color: '#ccc',
              margin: 0
            }}>
              <strong>Troubleshooting tips:</strong><br/>
              • Clear your browser cache and cookies<br/>
              • Try using incognito/private browsing mode<br/>
              • Disable browser extensions temporarily<br/>
              • Check if the issue persists on a different browser
            </p>
          </div>
        )}
      </div>
    </>
  );
};
