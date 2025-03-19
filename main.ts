import { Plugin, TFile } from 'obsidian';

export default class MusicNotePlugin extends Plugin {
    private audio: HTMLAudioElement | null = null;
    private isPlaying: boolean = false;
    private toggleButton: HTMLElement | null = null;
    private currentUrl: string | null = null;
    private hiddenIframe: HTMLIFrameElement | null = null;
    private userStopped: boolean = false; // 사용자가 Stop 버튼을 눌렀는지 체크
    private scrollContainer: HTMLElement | null = null;

    async onload() {
        console.log("Music Note Plugin Loaded!");

        // 하단 상태바에 버튼 추가 (UI 없이 버튼만)
        this.toggleButton = this.addStatusBarItem().createEl("button", { text: "Play" });
        this.toggleButton.style.backgroundColor = "transparent";
        this.toggleButton.style.border = "none";
        this.toggleButton.style.cursor = "pointer";
        this.toggleButton.style.color = "#8A8A8A";
        this.toggleButton.style.display = "none"; // 기본적으로 숨김

        // 버튼 클릭 이벤트 추가
        this.toggleButton.addEventListener("click", () => {
            if (!this.currentUrl) return;

            if (this.isPlaying) {
                this.userStopped = true; // 사용자가 직접 Stop 버튼을 눌렀으므로 자동 재생 차단
                this.stopAudio();
            } else {
                this.userStopped = false; // 다시 Play하면 자동 재생 활성화
                this.playAudio();
            }
        });

        // 노트가 열릴 때마다 확인
        this.registerEvent(
            this.app.workspace.on("file-open", (file: TFile | null) => {
                this.checkAudioContent(file);
            })
        );

        // 스크롤 이벤트 바인딩
        this.registerEvent(
            this.app.workspace.on("layout-change", () => {
                this.setupScrollListener();
            })
        );

        // 현재 열려있는 파일 체크
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.checkAudioContent(activeFile);
        }

        // 처음 시작할 때 스크롤 감지 셋업
        this.setupScrollListener();
    }

    private async checkAudioContent(file: TFile | null) {
        if (!file || !this.toggleButton) return;

        const content = await this.app.vault.read(file);
        const audioUrl = this.extractAudioUrl(content);

        if (audioUrl) {
            this.currentUrl = audioUrl;
            this.toggleButton.style.display = "block"; // 버튼 보이기
        } else {
            this.currentUrl = null;
            this.toggleButton.style.display = "none"; // 버튼 숨기기
            this.stopAudio();
        }
    }

    private extractAudioUrl(content: string): string | null {
        // 유튜브 링크 감지
        const youtubeMatch = content.match(/(https?:\/\/(?:music\.|www\.)?youtube\.com\/watch\?v=[\w-]+)/);
        if (youtubeMatch) {
            return youtubeMatch[0];
        }

        // MP3 파일 감지
        const mp3Match = content.match(/(https?:\/\/[^\s]+\.mp3)/);
        if (mp3Match) {
            return mp3Match[0];
        }

        return null;
    }

    private playAudio() {
        if (!this.currentUrl || !this.toggleButton) return;

        if (this.currentUrl.includes("youtube.com")) {
            if (!this.hiddenIframe) {
                this.hiddenIframe = document.createElement("iframe");
                this.hiddenIframe.src = this.getYouTubeEmbedUrl(this.currentUrl);
                this.hiddenIframe.allow = "autoplay";
                this.hiddenIframe.style.display = "none"; // 화면에서 숨김
                document.body.appendChild(this.hiddenIframe);
            } else {
                this.hiddenIframe.src = this.getYouTubeEmbedUrl(this.currentUrl);
            }
        } else {
            if (!this.audio) {
                this.audio = new Audio(this.currentUrl);
            }
            this.audio.play().catch(error => console.log("Audio play failed:", error));
        }

        this.toggleButton.textContent = "Stop";
        this.isPlaying = true;
    }

    private stopAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }

        if (this.hiddenIframe) {
            this.hiddenIframe.remove();
            this.hiddenIframe = null;
        }

        if (this.toggleButton) {
            this.toggleButton.textContent = "Play";
        }

        this.isPlaying = false;
    }

    private getYouTubeEmbedUrl(url: string): string {
        const match = url.match(/v=([\w-]+)/);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
        }
        return "";
    }

    private setupScrollListener() {
        // 기존 이벤트 제거 후 다시 추가
        if (this.scrollContainer) {
            this.scrollContainer.removeEventListener("scroll", this.handleScroll.bind(this));
        }

        // 현재 활성화된 Markdown 뷰 찾기
        this.scrollContainer = document.querySelector(
            ".markdown-source-view div.cm-scroller, .markdown-preview-view"
        ) as HTMLElement | null;

        if (this.scrollContainer) {
            this.scrollContainer.addEventListener("scroll", this.handleScroll.bind(this));
        }
    }

    private handleScroll(event: Event) {
        if (!this.currentUrl || this.userStopped) return; // 사용자가 Stop을 눌렀다면 자동 재생 안함

        if (!this.scrollContainer) return;

        const scrollTop = this.scrollContainer.scrollTop || 0;

        if (scrollTop === 0) {
            // 최상단이면 Stop
            if (this.isPlaying) {
                this.stopAudio();
            }
        } else {
            // 스크롤 내리면 Play
            if (!this.isPlaying) {
                this.playAudio();
            }
        }
    }

    onunload() {
        console.log("Music Note Plugin Unloaded!");
        this.stopAudio();

        if (this.scrollContainer) {
            this.scrollContainer.removeEventListener("scroll", this.handleScroll.bind(this));
        }
    }
}