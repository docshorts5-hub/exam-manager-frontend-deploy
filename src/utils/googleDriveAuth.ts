function getGapi() {
  if (typeof window === "undefined" || !window.gapi) {
    throw new Error("Google API client is not loaded");
  }
  return window.gapi;
}

export async function initGoogleDrive(clientId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const gapi = getGapi();
      gapi.load("client:auth2", async () => {
        try {
          await gapi.client.init({
            clientId,
            scope: "https://www.googleapis.com/auth/drive.file",
          });
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function googleDriveLogin(): Promise<string> {
  const gapi = getGapi();
  const auth = gapi.auth2.getAuthInstance();

  if (!auth.isSignedIn.get()) {
    await auth.signIn();
  }

  const token = gapi.auth.getToken()?.access_token;
  if (!token) throw new Error("Google Drive access token is unavailable");
  return token;
}
