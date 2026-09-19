# Paneli VPS'e canlıya alma — Docker + CI/CD + reverse proxy + erişim duvarı

**Tarih:** 2026-09-18
**Repo:** `kpss-admin-panel` (Next.js 16, standalone)
**İkiz repo (aynı VPS):** `KpssSoru-backend` (.NET) — panelin katılacağı prod stack + Caddy orada.
Panelin canlı çalışması backend'in Caddy'sine ve iç ağına bağlı; bu spec ikisi arası entegrasyonu
da tanımlar.

## İstek

Admin panelini backend ile **aynı VPS'e** canlıya almak. Deploy **git üzerinden otomatik**
olacak; backend'in mevcut CI/CD kalıbı birebir aynalanacak (SSH + deploy anahtarı, VPS'te build,
registry yok). Panel şimdilik bir **şifre duvarı (basic-auth)** arkasında olacak; IP kısıtlaması
sonra eklenecek.

## Kilitli kararlar (konuşuldu, onaylandı)

1. **Hedef:** Backend ile aynı VPS. Backend **zaten canlı** VPS'te.
2. **Pipeline deploy EDİLMEZ** — lokal Mac'te kalıyor. Panelin pipeline'a giden özellikleri
   canlıda çalışmayacak; **zarifçe hata vermeli** (çökme yok). Bkz. Bulgu §2.
3. **Deploy mekanizması:** Backend'i aynala — `appleboy/ssh-action` + `DEPLOY_HOST`/`DEPLOY_USER`/
   `DEPLOY_SSH_KEY` secret'ları; VPS'te `git reset --hard` + `docker compose ... up -d --build`.
   **GHCR/registry yok** (build VPS'te).
4. **Tetikleyici dal:** `main` (yalnız main'e push deploy eder). Çalışma `dev`'de sürer.
5. **Domain:** `admin.` REDDEDİLDİ. **Öneri: `panel.mikrokpss.com`** (backend `api.mikrokpss.com`).
   → _Review'da kesinleştirilecek tek isim kararı._
6. **Erişim duvarı:** Önce **Caddy basic-auth** (kullanıcı/şifre). **IP allowlist ERTELENDİ**
   (sonra `remote_ip`; sabit IP / VPN / Tailscale netleşince).
7. **Panelin kendi kodu değişmez** — bu iş sadece deploy artefaktları + reverse proxy.

## Bulgu (kod ve altyapı okundu)

**§1 — Yerel imaj HAZIR + COMMIT'Lİ (`9e05978`).**
- `next.config.ts` → `output: "standalone"`; `Dockerfile` çok aşamalı (deps/builder/runner),
  non-root `nextjs`; `.dockerignore` var.
- **Önemli düzeltme:** commit'li `package-lock.json` **cross-platform tutarsız** — `@img/sharp-wasm32`'ın
  linux'a özgü `@emnapi/*` optional-dep girdileri eksik (darwin'de üretilmiş lock), `npm ci`'nin katı
  senkron kontrolü hem container'da hem CI'da patlıyor. **Çözüm:** Dockerfile'da `npm ci` yerine
  `npm install --no-audit --no-fund` (sürümler lock'tan sabit, boşluğu tolere eder). CI'da da aynı.
  `npm audit` = 0 açık; lock'a dokunulmadı.
- **Yerel doğrulama YAPILDI:** imaj 339MB; `/login` → 200 (form render); `/` → 307 `/login`
  (auth guard); backend erişilemezken container ayakta kalıyor.

**§2 — Pipeline'sız zarif bozulma DOĞRULANDI.** `lib/api/pipeline-proxy.ts`: `PIPELINE_URL` boş/tanımsızsa
`fetch` geçersiz URL'e düşer → `catch` **502 + `{error}`** döner, route/container çökmez. Yani panel
pipeline olmadan da sağlıklı ayakta kalır (pipeline UI'ları hata banner'ı gösterir).

**§3 — Panel backend'e SUNUCU TARAFI proxy ile gider.** `lib/api/client.ts` baseURL = `/api/backend/api/v1`
(aynı origin → Next proxy `app/api/backend/[...path]/route.ts` → `${BACKEND_URL}`). Login/logout da
`app/api/auth/*` sunucu route'larından. **Tarayıcı asla backend'e doğrudan gitmez** → panel için
**CORS gerekmez.** (Backend `.env.prod`'daki `CORS_ALLOWED_ORIGINS` panel için şart değil; yalnız
tutarlılık için yeni domain'e güncellenebilir.)

**§4 — Secure cookie HTTPS ister → Caddy zaten sağlıyor.** `lib/auth/cookies.ts`: prod'da auth cookie
`Secure`. Backend Caddy'si Let's Encrypt ile otomatik HTTPS veriyor → panel de HTTPS'ten servis
edilince cookie sorunsuz yazılır. HTTP olsaydı login "başarılı" görünür ama oturum tutmazdı.

**§5 — Backend CI/CD kalıbı (`KpssSoru-backend/.github/workflows/cicd.yml`).**
- `push/PR → dev,main`: `build` job (restore/build/test).
- `deploy` job: `if main && push`, `needs: build`. `appleboy/ssh-action@v1.2.0` →
  `cd /root/KpssSoru-backend; git fetch origin main; git reset --hard origin/main;
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build; docker image prune -f`.

**§6 — Backend prod stack (`docker-compose.prod.yml` + `Caddyfile`).**
- Servisler: `caddy` (80/443, Let's Encrypt volume'ları, `{$DOMAIN}` env, `reverse_proxy api:8080`),
  `api` (expose 8080 — **yalnız iç ağ**), `postgres` (iç ağ). Redis yok.
- Ağ: `kpssapp-network` (bridge, **explicit `name:` YOK** → gerçek ad proje-önekli:
  muhtemelen `kpsssoru-backend_kpssapp-network` — **VPS'te doğrulanacak**).
- Caddyfile **tek site bloğu** (`{$DOMAIN}` = `api.mikrokpss.com`). Panel için **ikinci blok**
  eklenmeli.
- Backend `.env.prod.example` **zaten `CORS_ALLOWED_ORIGINS=https://admin.mikrokpss.com`** içeriyor
  (panelin öngörülmüş olduğunu doğrular; domain değişirse güncellenebilir — §3 gereği zorunlu değil).

## Mimari — panel VPS stack'ine nasıl girer

**Seçilen yaklaşım (öneri): Ayrı compose + dış (external) ağ.** Panel kendi
`docker-compose.prod.yml`'ına sahip; backend'in oluşturduğu `kpssapp-network`'e **dıştan** katılır;
backend'e `http://api:8080` iç adresinden ulaşır; Caddy (backend stack'inde) panel container'ına
aynı ağdan `panel:3000` olarak erişir.

- **Neden:** İki repo bağımsız kalır; panelin deploy'u yalnız panel reposuna dokunur; backend
  stack'i etkilenmez. Backend'in "her servis kendi bağımsız stack'i" felsefesiyle uyumlu.
- **Tek çapraz-repo dokunuş:** backend Caddyfile'ına panel bloğu (bir kerelik).

**Değerlendirilen alternatif:** paneli backend'in `docker-compose.prod.yml`'ına servis olarak eklemek.
Reddedildi — panel kaynağı ayrı repoda; backend compose'unu panel checkout yoluna/imajına bağlamak
iki repoyu birbirine kilitler, deploy sınırlarını bulanıklaştırır.

## Bileşenler

### A. Panel reposu — YENİ dosyalar (bu repo, benim)

**A1. `.github/workflows/cicd.yml`** — backend'i aynalar:
- `on: push/PR → [dev, main]`.
- `build` job (`ubuntu-latest`): checkout → `setup-node@22` → `npm install --no-audit --no-fund`
  → `npm run lint` → `npm run build`. (Not: `npm ci` DEĞİL — §1 lock gerekçesi. Node 22 = Docker
  build'iyle aynı.)
- `deploy` job: `needs: build`, `if: main && push`. `appleboy/ssh-action@v1.2.0` →
  `cd /root/MicroKpss-AdminPanel-UI; git fetch origin main; git reset --hard origin/main;
  docker compose -f docker-compose.prod.yml up -d --build; docker image prune -f`.
  Secret'lar: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (backend'le aynı VPS/kullanıcı).

**A2. `docker-compose.prod.yml`** — tek `panel` servisi:
- `build: context: ., dockerfile: Dockerfile`; `container_name: panel`; `restart: unless-stopped`.
- `expose: ["3000"]` — **dışarı port AÇILMAZ** (yalnız Caddy iç ağdan).
- `environment`: `NODE_ENV=production`, `BACKEND_URL=http://api:8080`. **Pipeline env YOK** (boş →
  §2 zarif 502). Panelde prod sırrı yok.
- `networks: [kpssapp-network]`; en altta `kpssapp-network: { external: true, name: <gerçek-ad> }`
  (gerçek ad VPS doğrulamasından — bkz. Açık noktalar).

### B. Backend reposu — çapraz-repo dokunuş (kullanıcının repo'su; ayrı commit)

**B1. `Caddyfile`'a panel bloğu (+ basic-auth):**
```
panel.mikrokpss.com {
    encode gzip
    basic_auth {
        <kullanici_adi> <bcrypt-hash>     # `caddy hash-password` ile üretilir
    }
    reverse_proxy panel:3000
    log { output stdout; format console }
}
```
- Caddyfile caddy container'ına read-only mount'lu → düzenleme sonrası backend'in caddy'si
  reload edilmeli (sonraki backend deploy'u ya da elle `docker compose ... up -d` / `caddy reload`).
- IP allowlist ERTELENDİ: ileride `@izinli remote_ip ...` + `handle @izinli { ... }` eklenerek.

### C. Bir kerelik VPS bootstrap (manuel; backend'de de yapıldı)

1. **DNS:** `panel.mikrokpss.com` A kaydı → VPS IP.
2. **Repo clone:** VPS'te `git clone <panel-repo> /root/MicroKpss-AdminPanel-UI` (deploy script bu
   yolu bekler; ilk `git reset` için mevcut clone şart).
3. **GitHub secret'ları:** panel reposuna `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (backend'le
   aynı değerler; secret'lar repo-bazlı).
4. **Ağ adı doğrula:** `docker network ls | grep kpssapp` → panel compose'daki `external name` buna
   ayarlanır. (Alternatif: backend compose'a `name: kpssapp-network` eklenip ağ sabitlenir — daha
   invaziv, ağ yeniden yaratılır; tercih: mevcut adı doğrulamak.)
5. **basic-auth kimlik:** kullanıcı adı + şifre belirle → `caddy hash-password` ile hash → B1'e.
6. **Caddy bloğu:** B1 backend Caddyfile'a eklenir, caddy reload.
7. **İlk deploy:** `main` güncellenip push'lanınca CI/CD çalışır (ya da ilk sefer VPS'te elle
   `docker compose -f docker-compose.prod.yml up -d --build`).

## Veri akışı (canlı)

```
Tarayıcı → HTTPS → Caddy (panel.mikrokpss.com)
                     ├─ basic-auth duvarı (401 → kullanıcı/şifre)
                     └─ reverse_proxy panel:3000
                          → Next panel (SSR + /api/backend/* proxy)
                             → http://api:8080/api/v1/*  (iç ağ, backend)
```
Pipeline yolu: panel → `PIPELINE_URL` (boş) → 502 zarif hata banner'ı.

## Dal stratejisi (deploy `main`'den)

Şu an `dev`, `origin/dev`'in 4 commit önünde (3 "Tüm kaynaktan" + 1 Docker `9e05978`), **push'suz**.
Deploy `main`'den olacağı için:
- `main`, `dev`'in durumuna getirilmeli (merge/fast-forward), CI/CD dosyaları + compose main'de olmalı.
- Uyarı: main'e taşınınca askıdaki "Tüm kaynaktan" (pipeline senkron/bloklu) + varsa yarım işler de
  canlıya gider — **ama pipeline deploy edilmediği için o özellikler zaten çalışmaz (zarif 502)**,
  yeni işlevsel risk yok. Yine de review'da: main'e neyin gideceği bilinçli onaylanmalı.
- _Açık:_ dev'i olduğu gibi main'e mi taşıyalım, yoksa yalnız deploy'a gerekli commit'leri mi
  (Docker + CI/CD) main'e alıp "Tüm kaynaktan" işini dev'de mi tutalım? → Review kararı.

## Test / doğrulama

- **Yerel imaj:** ✅ yapıldı (§1).
- **CI (build job):** push sonrası GitHub'da `npm install`+`lint`+`build` yeşil.
- **Deploy job:** main'e push → SSH deploy loglar yeşil; VPS'te `docker ps` panel `Up`.
- **Canlı smoke:** (1) `https://panel.mikrokpss.com` → basic-auth penceresi; (2) geçince login;
  (3) giriş sonrası **oturum tutuyor** (secure cookie — sayfa yenile, hâlâ girişli); (4) bir liste
  sayfası backend proxy'den yükleniyor; (5) pipeline sayfası → zarif hata (çökme yok); (6) izinsiz
  test: yanlış basic-auth → 401.

## Kapsam dışı (YAGNI)

- Pipeline'ın deploy'u (lokal kalıyor).
- IP allowlist (sonra; basic-auth şimdilik yeterli).
- Registry/GHCR (backend kalıbı VPS'te build ediyor).
- Askıdaki "Tüm kaynaktan" pipeline job-model işi + AI-zorluk işi (ayrı, bağımsız).
- Panelin kendi kodunda değişiklik.

## Açık noktalar (review'da netleşecek)

1. **Domain adı** — `panel.mikrokpss.com` onay mı? (backend `api.`, `admin.` reddedildi.)
2. **Dal stratejisi** — main'e ne gidecek (§ Dal stratejisi).
3. **Paylaşılan ağın gerçek adı** — VPS `docker network ls` ile doğrulanacak (bootstrap C4).
4. **basic-auth kullanıcı adı + şifre** — uygulama anında kullanıcıdan (hash'i ben üretirim).
5. **DEPLOY_* secret değerleri** — kullanıcı GitHub'da ekleyecek (SSH deploy anahtarı backend'le aynı).
