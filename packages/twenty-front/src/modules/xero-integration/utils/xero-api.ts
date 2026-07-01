import { type AuthTokenPair } from '~/generated-metadata/graphql';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const buildHeaders = (tokenPair: AuthTokenPair | null): HeadersInit => {
  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const xeroFetch = async <T,>(
  path: string,
  tokenPair: AuthTokenPair | null,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(tokenPair),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');

    throw new Error(`${response.status} ${response.statusText} ${text}`);
  }

  return (await response.json()) as T;
};
