import { REPO_NAME, REPO_OWNER } from './config';

/** Da ⭐ al repo con el token del usuario (requiere scope public_repo). */
export async function starRepo(token: string): Promise<boolean> {
  const res = await fetch(`https://api.github.com/user/starred/${REPO_OWNER}/${REPO_NAME}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return res.status === 204;
}

/** Número de estrellas (API pública, sin token: 60 req/h por IP, por eso cacheamos). */
export async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}
