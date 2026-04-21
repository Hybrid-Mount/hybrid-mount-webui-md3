import { createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { uiStore } from "../lib/stores/uiStore";
import { sysStore } from "../lib/stores/sysStore";
import { API } from "../lib/api";
import { ICONS } from "../lib/constants";
import { IS_RELEASE } from "../lib/constants_gen";
import "./InfoTab.css";
import Skeleton from "../components/Skeleton";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/text-button.js";
import "@material/web/dialog/dialog.js";
import "@material/web/icon/icon.js";
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";

const PRIMARY_REPO_OWNER = "Hybrid-Mount";
const PRIMARY_REPO_NAME = "meta-hybrid_mount";
const WEBUI_REPO_OWNER = "Hybrid-Mount";
const WEBUI_REPO_NAME = "hybrid-mount-webui-md3";
const TELEGRAM_LINK = "https://t.me/hybridmountchat";
const PAYPAL_LINK = "https://www.paypal.me/LangQin280";
const CACHE_DURATION = 1000 * 60 * 60;
const DETAIL_FETCH_LIMIT = 12;

const CONTRIBUTOR_REPOS = [
  {
    id: "core",
    owner: PRIMARY_REPO_OWNER,
    name: PRIMARY_REPO_NAME,
    label: "Hybrid Mount",
    cacheKey: "hm_contributors_cache_core",
  },
  {
    id: "webui",
    owner: WEBUI_REPO_OWNER,
    name: WEBUI_REPO_NAME,
    label: "WebUI",
    cacheKey: "hm_contributors_cache_webui",
  },
] as const;

interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  type: string;
  url: string;
  name?: string;
  bio?: string;
}

interface ContributorCache {
  data: Contributor[];
  timestamp: number;
}

interface ContributorSection {
  id: string;
  label: string;
  repoDisplayName: string;
  repoUrl: string;
  contributors: Contributor[];
  error: boolean;
}

interface MdDialogElement extends HTMLElement {
  show: () => void;
  close: () => void;
}

export default function InfoTab() {
  const [contributorSections, setContributorSections] = createSignal<
    ContributorSection[]
  >([]);
  const [loading, setLoading] = createSignal(true);
  const [activeQr, setActiveQr] = createSignal<string>("");
  const controller = new AbortController();

  let donateDialogRef: HTMLElement | undefined;
  let qrDialogRef: HTMLElement | undefined;

  const isDev = () => !IS_RELEASE;

  onMount(() => {
    void fetchContributors();
  });
  onCleanup(() => controller.abort());

  async function fetchContributors() {
    try {
      const results = await Promise.allSettled(
        CONTRIBUTOR_REPOS.map(async (repo) => {
          const contributors = await fetchRepoContributors(repo);
          return {
            id: repo.id,
            label: repo.label,
            repoDisplayName: `${repo.owner}/${repo.name}`,
            repoUrl: `https://github.com/${repo.owner}/${repo.name}`,
            contributors,
            error: false,
          } satisfies ContributorSection;
        }),
      );

      const sections = results.map((result, index) => {
        const repo = CONTRIBUTOR_REPOS[index];
        if (result.status === "fulfilled") {
          return result.value;
        }

        console.error(result.reason);
        return {
          id: repo.id,
          label: repo.label,
          repoDisplayName: `${repo.owner}/${repo.name}`,
          repoUrl: `https://github.com/${repo.owner}/${repo.name}`,
          contributors: [],
          error: true,
        } satisfies ContributorSection;
      });

      setContributorSections(sections);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRepoContributors(
    repo: (typeof CONTRIBUTOR_REPOS)[number],
  ): Promise<Contributor[]> {
    const cached = localStorage.getItem(repo.cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached) as ContributorCache;
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      } catch {
        localStorage.removeItem(repo.cacheKey);
      }
    }

    const res = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/contributors`,
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error(`Failed to fetch ${repo.owner}/${repo.name}`);

    const basicList = (await res.json()) as Contributor[];
    const filteredList = basicList.filter((user) => {
      const isBotType = user.type === "Bot";
      const hasBotName = user.login.toLowerCase().includes("bot");
      return !isBotType && !hasBotName;
    });

    const enriched = [...filteredList];
    const targets = filteredList.slice(0, DETAIL_FETCH_LIMIT);
    const details = await Promise.allSettled(
      targets.map(async (user) => {
        const detailRes = await fetch(user.url, { signal: controller.signal });
        if (!detailRes.ok) throw new Error(`Failed to fetch ${user.login}`);
        const detail = await detailRes.json();
        return {
          ...user,
          bio: detail.bio || user.bio,
          name: detail.name || user.login,
        } as Contributor;
      }),
    );
    details.forEach((result, index) => {
      if (result.status === "fulfilled") {
        enriched[index] = result.value;
      }
    });

    localStorage.setItem(
      repo.cacheKey,
      JSON.stringify({
        data: enriched,
        timestamp: Date.now(),
      }),
    );

    return enriched;
  }

  function handleLink(e: MouseEvent, url: string) {
    e.preventDefault();
    const openLink = API.openLink?.bind(API);

    if (!openLink) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    void openLink(url).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function openDonate(e: MouseEvent) {
    e.preventDefault();
    (donateDialogRef as MdDialogElement)?.show();
  }

  function closeDonate() {
    (donateDialogRef as MdDialogElement)?.close();
  }

  function openQr(path: string) {
    setActiveQr(path);
    (qrDialogRef as MdDialogElement)?.show();
  }

  function closeQr() {
    (qrDialogRef as MdDialogElement)?.close();
  }

  return (
    <div class="info-container">
      <div class="project-header">
        <div class="app-logo">
          <Show
            when={!isDev()}
            fallback={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 120 120"
                class="dev-logo"
              >
                <circle cx="60" cy="60" r="50" class="logo-base-track" />
                <circle cx="60" cy="60" r="38" class="logo-base-track" />
                <circle cx="60" cy="60" r="26" class="logo-base-track" />

                <g class="dev-logo-outer-group">
                  <path
                    d="M 60 10 A 50 50 0 1 1 10 60"
                    class="logo-arc logo-arc-outer"
                  />
                </g>

                <g class="dev-logo-mid-group">
                  <path
                    d="M 60 22 A 38 38 0 0 1 60 98"
                    class="logo-arc logo-arc-mid logo-arc-error"
                  />
                </g>

                <g class="dev-logo-inner-group">
                  <path
                    d="M 60 34 A 26 26 0 1 1 47 82.5"
                    class="logo-arc logo-arc-inner"
                  />
                </g>

                <circle cx="60" cy="60" r="10" class="logo-core" />
              </svg>
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" class="logo-base-track" />
              <circle cx="60" cy="60" r="38" class="logo-base-track" />
              <circle cx="60" cy="60" r="26" class="logo-base-track" />

              <path
                d="M60 10 A 50 50 0 0 1 110 60"
                class="logo-arc logo-arc-outer"
              />
              <path
                d="M60 98 A 38 38 0 0 1 60 22"
                class="logo-arc logo-arc-mid"
              />
              <path
                d="M34 60 A 26 26 0 1 1 86 60"
                class="logo-arc logo-arc-inner"
              />

              <circle cx="60" cy="60" r="10" class="logo-core" />
            </svg>
          </Show>
        </div>
        <span class="app-name">{uiStore.L.common.appName}</span>
        <span class="app-version">{sysStore.version}</span>
      </div>

      <div class="action-buttons">
        <md-filled-tonal-button
          class="action-btn"
          onClick={(e: MouseEvent) =>
            handleLink(
              e,
              `https://github.com/${PRIMARY_REPO_OWNER}/${PRIMARY_REPO_NAME}`,
            )
          }
        >
          <md-icon slot="icon">
            <svg viewBox="0 0 24 24">
              <path d={ICONS.github} />
            </svg>
          </md-icon>
          {uiStore.L.info.projectLink}
        </md-filled-tonal-button>

        <md-filled-tonal-button
          class="action-btn"
          onClick={(e: MouseEvent) => handleLink(e, TELEGRAM_LINK)}
        >
          <md-icon slot="icon">
            <svg viewBox="0 0 24 24">
              <path d={ICONS.telegram} />
            </svg>
          </md-icon>
          {uiStore.L.info?.telegram ?? "Telegram"}
        </md-filled-tonal-button>

        <md-filled-tonal-button
          class="action-btn donate-btn"
          onClick={openDonate}
        >
          <md-icon slot="icon">
            <svg viewBox="0 0 24 24">
              <path d={ICONS.donate} />
            </svg>
          </md-icon>
          {uiStore.L.info.donate}
        </md-filled-tonal-button>
      </div>

      <div class="contributors-section">
        <div class="section-title">{uiStore.L.info.contributors}</div>

        <div class="contributors-groups">
          <Show
            when={!loading()}
            fallback={
              <For each={CONTRIBUTOR_REPOS}>
                {(repo) => (
                  <div class="contributor-group">
                    <div class="group-header">
                      <div class="group-title">{repo.label}</div>
                      <div class="group-subtitle">
                        {repo.owner}/{repo.name}
                      </div>
                    </div>
                    <div class="list-wrapper">
                      <For each={Array(3)}>
                        {() => (
                          <div class="skeleton-item">
                            <Skeleton variant="contributor-avatar" />
                            <div class="skeleton-text">
                              <Skeleton variant="contributor-title" />
                              <Skeleton variant="contributor-body" />
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            }
          >
            <For each={contributorSections()}>
              {(section) => (
                <div class="contributor-group">
                  <div class="group-header">
                    <button
                      class="group-link"
                      onClick={(e: MouseEvent) =>
                        handleLink(e, section.repoUrl)
                      }
                    >
                      <div class="group-title">{section.label}</div>
                      <div class="group-subtitle">
                        {section.repoDisplayName}
                      </div>
                    </button>
                  </div>

                  <div class="list-wrapper">
                    <Show
                      when={!section.error}
                      fallback={
                        <div class="error-message">
                          {uiStore.L.info.loadFail}
                        </div>
                      }
                    >
                      <md-list class="contributors-list">
                        <For each={section.contributors}>
                          {(user) => (
                            <md-list-item
                              class="contributor-link"
                              type="link"
                              href={user.html_url}
                              target="_blank"
                              onClick={(e: MouseEvent) =>
                                handleLink(e, user.html_url)
                              }
                            >
                              <img
                                slot="start"
                                src={`${user.avatar_url}${user.avatar_url.includes("?") ? "&" : "?"}s=80`}
                                alt={user.login}
                                class="c-avatar"
                                loading="lazy"
                              />
                              <div slot="headline">
                                {user.name || user.login}
                              </div>
                              <div slot="supporting-text">
                                {user.bio || uiStore.L.info.noBio}
                              </div>
                            </md-list-item>
                          )}
                        </For>
                      </md-list>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>

      <md-dialog ref={donateDialogRef} class="donate-dialog">
        <div slot="headline">{uiStore.L.info?.supportUs ?? "Support Us"}</div>
        <div slot="content" class="donate-content">
          <div class="donate-section">
            <div class="author-label">
              {uiStore.L.info?.authorYuzaki ?? "YuzakiKokuban"}
            </div>
            <div class="donate-grid">
              <md-filled-tonal-button
                onClick={() => openQr("/assets/donate/yuzaki_alipay.jpg")}
              >
                Alipay
              </md-filled-tonal-button>
              <md-filled-tonal-button
                onClick={() => openQr("/assets/donate/yuzaki_wechat.jpg")}
              >
                WeChat
              </md-filled-tonal-button>
              <md-filled-tonal-button
                onClick={() => openQr("/assets/donate/yuzaki_binance.jpg")}
              >
                Binance
              </md-filled-tonal-button>
              <md-filled-tonal-button
                onClick={(e: MouseEvent) => handleLink(e, PAYPAL_LINK)}
              >
                <md-icon slot="icon">
                  <svg viewBox="0 0 24 24">
                    <path d={ICONS.donate} />
                  </svg>
                </md-icon>
                PayPal
              </md-filled-tonal-button>
            </div>
          </div>

          <div class="donate-divider"></div>

          <div class="donate-section">
            <div class="author-label">Tools-cx-app</div>
            <div class="donate-grid">
              <md-filled-tonal-button
                onClick={() => openQr("/assets/donate/tools_wechat.jpg")}
              >
                WeChat
              </md-filled-tonal-button>
            </div>
          </div>
        </div>
        <div slot="actions">
          <md-text-button onClick={closeDonate}>Close</md-text-button>
        </div>
      </md-dialog>

      <md-dialog ref={qrDialogRef} class="qr-dialog" onClick={closeQr}>
        <div slot="content" class="qr-content-wrapper">
          <img src={activeQr()} alt="Scan QR Code" />
        </div>
      </md-dialog>
    </div>
  );
}
