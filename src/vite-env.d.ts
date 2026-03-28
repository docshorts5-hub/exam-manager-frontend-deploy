/// <reference types="vite/client" />

interface Window {
  gapi?: {
    load: (api: string, cb: () => void) => void;
    client: {
      init: (config: { clientId: string; scope: string }) => Promise<void>;
    };
    auth2: {
      getAuthInstance: () => {
        isSignedIn: { get: () => boolean };
        signIn: () => Promise<void>;
      };
    };
    auth: {
      getToken: () => { access_token?: string } | null;
    };
  };
}
