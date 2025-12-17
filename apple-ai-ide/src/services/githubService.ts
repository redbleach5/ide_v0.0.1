import { logger } from '../utils/logger';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  pushed_at: string;
  updated_at: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

class GitHubService {
  private baseUrl = 'https://api.github.com';
  private token: string | null = null;

  /**
   * Set GitHub Personal Access Token
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Get authentication headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }

  /**
   * Check if token is valid
   */
  async validateToken(token?: string): Promise<boolean> {
    const tokenToUse = token || this.token;
    if (!tokenToUse) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `token ${tokenToUse}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Error validating GitHub token:', error);
      return false;
    }
  }

  /**
   * Get authenticated user info
   */
  async getUser(): Promise<{ login: string; avatar_url: string; name: string } | null> {
    if (!this.token) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        login: data.login,
        avatar_url: data.avatar_url,
        name: data.name || data.login
      };
    } catch (error) {
      logger.error('Error fetching GitHub user:', error);
      return null;
    }
  }

  /**
   * Get user repositories
   */
  async getRepositories(): Promise<GitHubRepository[]> {
    if (!this.token) {
      throw new Error('GitHub token is not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/user/repos?sort=updated&per_page=100`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        default_branch: repo.default_branch,
        pushed_at: repo.pushed_at,
        updated_at: repo.updated_at,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        language: repo.language
      }));
    } catch (error) {
      logger.error('Error fetching repositories:', error);
      throw error;
    }
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        description: data.description,
        private: data.private,
        html_url: data.html_url,
        clone_url: data.clone_url,
        ssh_url: data.ssh_url,
        default_branch: data.default_branch,
        pushed_at: data.pushed_at,
        updated_at: data.updated_at,
        stargazers_count: data.stargazers_count,
        forks_count: data.forks_count,
        language: data.language
      };
    } catch (error) {
      logger.error('Error fetching repository:', error);
      return null;
    }
  }

  /**
   * Get repository branches
   */
  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    if (!this.token) {
      throw new Error('GitHub token is not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/branches`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((branch: any) => ({
        name: branch.name,
        commit: branch.commit,
        protected: branch.protected || false
      }));
    } catch (error) {
      logger.error('Error fetching branches:', error);
      throw error;
    }
  }

  /**
   * Get repository pull requests
   */
  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
    if (!this.token) {
      throw new Error('GitHub token is not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.merged ? 'merged' : pr.state,
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url
        },
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        }
      }));
    } catch (error) {
      logger.error('Error fetching pull requests:', error);
      throw error;
    }
  }

  /**
   * Get repository issues
   */
  async getIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    if (!this.token) {
      throw new Error('GitHub token is not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues?state=${state}&per_page=100`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      // Filter out pull requests (they appear in issues API)
      return data
        .filter((issue: any) => !issue.pull_request)
        .map((issue: any) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          state: issue.state,
          user: {
            login: issue.user.login,
            avatar_url: issue.user.avatar_url
          },
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          labels: (issue.labels || []).map((label: any) => ({
            name: label.name,
            color: label.color
          }))
        }));
    } catch (error) {
      logger.error('Error fetching issues:', error);
      throw error;
    }
  }

  /**
   * Get repository commits
   */
  async getCommits(owner: string, repo: string, branch: string = 'main', limit: number = 30): Promise<GitHubCommit[]> {
    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((commit: any) => ({
        sha: commit.sha.substring(0, 7),
        commit: {
          message: commit.commit.message,
          author: {
            name: commit.commit.author.name,
            email: commit.commit.author.email,
            date: commit.commit.author.date
          }
        },
        author: {
          login: commit.author?.login || commit.commit.author.name,
          avatar_url: commit.author?.avatar_url || ''
        },
        html_url: commit.html_url
      }));
    } catch (error) {
      logger.error('Error fetching commits:', error);
      throw error;
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<GitHubPullRequest | null> {
    if (!this.token) {
      throw new Error('GitHub token is not set');
    }

    try {
      const response = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          title,
          body,
          head,
          base
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        number: data.number,
        title: data.title,
        body: data.body || '',
        state: data.merged ? 'merged' : data.state,
        user: {
          login: data.user.login,
          avatar_url: data.user.avatar_url
        },
        created_at: data.created_at,
        updated_at: data.updated_at,
        head: {
          ref: data.head.ref,
          sha: data.head.sha
        },
        base: {
          ref: data.base.ref,
          sha: data.base.sha
        }
      };
    } catch (error) {
      logger.error('Error creating pull request:', error);
      throw error;
    }
  }
}

export const githubService = new GitHubService();
