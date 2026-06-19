/**
 * Minimal ambient types for the Google Identity Services (GIS) and Google
 * Picker browser globals. Only the surface this app actually touches is
 * declared — the full SDKs are large and we call a tiny slice. The real
 * objects come from the scripts loaded at runtime (see `_lib/google.ts`);
 * these declarations only describe their shape for the type checker.
 */

declare global {
  const gapi: {
    load(api: 'picker', callback: () => void): void;
  };

  namespace google.accounts.oauth2 {
    interface TokenResponse {
      access_token: string;
      error?: string;
    }

    interface TokenClient {
      requestAccessToken(overrides?: { prompt?: string }): void;
    }

    interface TokenClientConfig {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
    }

    function initTokenClient(config: TokenClientConfig): TokenClient;
  }

  namespace google.picker {
    enum ViewId {
      DOCS = 'docs',
    }

    enum DocsViewMode {
      LIST = 'list',
      GRID = 'grid',
    }

    enum Action {
      PICKED = 'picked',
      CANCEL = 'cancel',
      LOADED = 'loaded',
    }

    class DocsView {
      constructor(viewId?: ViewId);
      setMode(mode: DocsViewMode): this;
      setIncludeFolders(included: boolean): this;
      setSelectFolderEnabled(enabled: boolean): this;
      setMimeTypes(mimeTypes: string): this;
    }

    interface PickerDocument {
      id: string;
      name: string;
      mimeType: string;
    }

    interface ResponseObject {
      action: Action;
      docs: PickerDocument[];
    }

    class Picker {
      setVisible(visible: boolean): void;
    }

    class PickerBuilder {
      addView(view: DocsView): this;
      setOAuthToken(token: string): this;
      setDeveloperKey(key: string): this;
      setAppId(appId: string): this;
      setCallback(callback: (data: ResponseObject) => void): this;
      build(): Picker;
    }
  }
}

export {};
