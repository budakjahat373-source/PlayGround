# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/budakjahat373-source/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/budakjahat373-source/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/budakjahat373-source/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/budakjahat373-source/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/budakjahat373-source/PlayGround).
- 🛠️ [Check build runs](https://github.com/budakjahat373-source/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/budakjahat373-source/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/budakjahat373-source).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

---

# NAGA & TITAN

Game jet tempur 2D vertikal untuk ponsel dan tablet. Terbang melewati langit senja, jatuhkan Naga Merah, lalu hancurkan Titan-9 di kota baja.

Dibuat tanpa aset atau dependensi eksternal: seluruh grafis, efek suara, dan musik dihasilkan secara prosedural dengan Canvas 2D dan Web Audio.

## Menjalankan

Karena memakai ES modules, jalankan lewat server lokal:

```bash
python3 -m http.server 8000
```

Buka `http://localhost:8000` di browser. Untuk pengalaman terbaik, gunakan mode potret di ponsel atau tablet.

## Kontrol

| Aksi | Sentuh | Keyboard |
| --- | --- | --- |
| Gerak | Geser jari di mana saja | WASD / panah |
| Tembak | Otomatis | Otomatis |
| Bom | Tombol **BOM** | Spasi |
| Jeda | Tombol ⏸ | P / Esc |
| Suara | Tombol ♪ | M |

- Kumpulkan power-up untuk menaikkan level tembakan.
- Bom menghapus peluru musuh di layar dan memberi damage besar.
- Nyawa, bom, dan power bertambah setelah menyelesaikan Stage 1.

## Stage

1. **Langit Senja** — Naga Merah: voli api, kipas api, sapuan napas, panggil anak naga, dan serangan menerjang.
2. **Kota Baja** — Titan-9: roket homing, hujan roket, gatling, laser sapuan, dan drone. Hancurkan kedua pod roketnya.

## Struktur

```
index.html        Shell halaman, canvas, dan tombol HUD
styles.css        Layout responsif, safe area, overlay
src/main.js       Menu, overlay, input UI, penyimpanan pengaturan
src/game.js       Game loop, stage, bos, collision, skor, debug helper
src/render.js     Seni prosedural, parallax, partikel, beam
src/audio.js      SFX dan musik sintetis Web Audio
```

## Debug (opsional)

Tambahkan parameter URL berikut untuk pengujian:

- `?play=1` — lewati menu
- `?stage=2` — mulai di Stage 2
- `?boss=1` — langsung ke bos
- `?invincible=1` — pemain kebal

Contoh: `http://localhost:8000/?play=1&boss=1&stage=2&invincible=1`
