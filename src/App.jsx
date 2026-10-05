
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API =
  "https://collectionapi.metmuseum.org/public/collection/v1";

const SEARCH_API =
  "https://collectionapi.metmuseum.org/public/collection/v1.1/search";

const PAGE_SIZE = 12;

const FEATURED_ARTISTS = [
  {
    name: "Vincent van Gogh",
    description: "Renklerin ve duyguların ustası",
    query: "Vincent van Gogh",
  },
  {
    name: "Claude Monet",
    description: "Empresyonizmin öncülerinden",
    query: "Claude Monet",
  },
  {
    name: "Rembrandt",
    description: "Işık ve gölgenin ustası",
    query: "Rembrandt",
  },
  {
    name: "Johannes Vermeer",
    description: "Sessiz anların ressamı",
    query: "Johannes Vermeer",
  },
];

const categories = [
  { label: "Tüm Eserler", value: "all", query: "" },
  { label: "Resim", value: "paintings", query: "painting" },
  { label: "Heykel", value: "sculpture", query: "sculpture" },
  { label: "Fotoğraf", value: "photography", query: "photograph" },
  { label: "Antik Eserler", value: "ancient", query: "ancient" },
  {
    label: "Dekoratif Sanatlar",
    value: "decorative",
    query: "decorative arts",
  },
];

const SORT_OPTIONS = [
  { label: "Varsayılan sıralama", value: "default" },
  { label: "Eser adı (A-Z)", value: "title-asc" },
  { label: "Eser adı (Z-A)", value: "title-desc" },
  { label: "Sanatçı (A-Z)", value: "artist-asc" },
  { label: "Sanatçı (Z-A)", value: "artist-desc" },
];

function readFavorites() {
  try {
    const saved = localStorage.getItem("museumFavorites");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Belirtilmemiş";
  }

  return value;
}

function App() {
  const [query, setQuery] = useState("sunflowers");
  const [submittedQuery, setSubmittedQuery] = useState("sunflowers");
  const [category, setCategory] = useState("all");
  const [activeView, setActiveView] = useState("collection");
  const [page, setPage] = useState(0);
  const [artworks, setArtworks] = useState([]);
  const [favorites, setFavorites] = useState(readFavorites);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [sortBy, setSortBy] = useState("default");
  const [quickFilter, setQuickFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalResults, setTotalResults] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  const [featuredArtworks, setFeaturedArtworks] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("museumFavorites", JSON.stringify(favorites));
  }, [favorites]);

  // Ana sayfa için öne çıkan eserleri getir.
  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedArtworks() {
      setFeaturedLoading(true);

      try {
        const searchUrl = new URL(SEARCH_API);
        searchUrl.searchParams.set("q", "sunflowers");
        searchUrl.searchParams.set("hasImages", "true");
        searchUrl.searchParams.set("limit", "6");
        searchUrl.searchParams.set("offset", "0");

        const response = await fetch(searchUrl);

        if (!response.ok) {
          throw new Error("Öne çıkan eserler yüklenemedi.");
        }

        const data = await response.json();
        const ids = (data.objectIDs || []).slice(0, 6);

        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const detailResponse = await fetch(`${API}/objects/${id}`);

              if (!detailResponse.ok) return null;

              const artwork = await detailResponse.json();

              if (!artwork.primaryImage && !artwork.primaryImageSmall) {
                return null;
              }

              return artwork;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setFeaturedArtworks(results.filter(Boolean));
        }
      } catch {
        if (!cancelled) {
          setFeaturedArtworks([]);
        }
      } finally {
        if (!cancelled) {
          setFeaturedLoading(false);
        }
      }
    }

    loadFeaturedArtworks();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ana koleksiyonu yükle.
  useEffect(() => {
    let cancelled = false;

    async function loadArtworks() {
      setLoading(true);
      setError("");
      setArtworks([]);

      try {
        const selectedCategory = categories.find(
          (item) => item.value === category
        );

        const searchTerms = [
          submittedQuery.trim(),
          selectedCategory?.query || "",
        ].filter(Boolean);

        const searchText = searchTerms.join(" ");

        const searchUrl = new URL(SEARCH_API);
        searchUrl.searchParams.set("q", searchText || "art");
        searchUrl.searchParams.set("hasImages", "true");
        searchUrl.searchParams.set("limit", String(PAGE_SIZE));
        searchUrl.searchParams.set(
          "offset",
          String(page * PAGE_SIZE)
        );

        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
          throw new Error("Eser araması şu anda yapılamıyor.");
        }

        const searchData = await searchResponse.json();

        if (cancelled) return;

        const objectIDs = searchData.objectIDs || [];
        setTotalResults(searchData.total || 0);

        if (objectIDs.length === 0) {
          setArtworks([]);
          return;
        }

        const details = await Promise.all(
          objectIDs.map(async (id) => {
            try {
              const response = await fetch(`${API}/objects/${id}`);

              if (!response.ok) return null;

              const artwork = await response.json();

              if (!artwork.primaryImage && !artwork.primaryImageSmall) {
                return null;
              }

              return artwork;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setArtworks(details.filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              "Eserler yüklenirken bir hata oluştu. Lütfen tekrar dene."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadArtworks();

    return () => {
      cancelled = true;
    };
  }, [submittedQuery, category, page, retryKey]);

  const displayedArtworks = useMemo(() => {
    let result = activeView === "favorites" ? favorites : artworks;

    const filter = quickFilter.trim().toLowerCase();

    if (filter) {
      result = result.filter((artwork) => {
        const title = (artwork.title || "").toLowerCase();
        const artist = (artwork.artistDisplayName || "").toLowerCase();
        const department = (artwork.department || "").toLowerCase();

        return (
          title.includes(filter) ||
          artist.includes(filter) ||
          department.includes(filter)
        );
      });
    }

    result = [...result];

    if (sortBy === "title-asc") {
      result.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      );
    } else if (sortBy === "title-desc") {
      result.sort((a, b) =>
        (b.title || "").localeCompare(a.title || "")
      );
    } else if (sortBy === "artist-asc") {
      result.sort((a, b) =>
        (a.artistDisplayName || "").localeCompare(
          b.artistDisplayName || ""
        )
      );
    } else if (sortBy === "artist-desc") {
      result.sort((a, b) =>
        (b.artistDisplayName || "").localeCompare(
          a.artistDisplayName || ""
        )
      );
    }

    return result;
  }, [activeView, artworks, favorites, quickFilter, sortBy]);

  function handleSearch(event) {
    event.preventDefault();
    setSubmittedQuery(query.trim() || "art");
    setPage(0);
    setActiveView("collection");
    setQuickFilter("");
  }

  function searchArtist(artistName) {
    if (!artistName) return;

    setQuery(artistName);
    setSubmittedQuery(artistName);
    setCategory("all");
    setPage(0);
    setQuickFilter("");
    setSortBy("default");
    setActiveView("collection");
    setSelectedArtwork(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFavorite(artwork) {
    setFavorites((current) => {
      const exists = current.some(
        (item) => item.objectID === artwork.objectID
      );

      if (exists) {
        return current.filter(
          (item) => item.objectID !== artwork.objectID
        );
      }

      return [...current, artwork];
    });
  }

  function isFavorite(artwork) {
    return favorites.some(
      (item) => item.objectID === artwork.objectID
    );
  }

  function selectCategory(value) {
    setCategory(value);
    setPage(0);
    setActiveView("collection");
  }

  function showCollection() {
    setActiveView("collection");
    setPage(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showFavorites() {
    setActiveView("favorites");
    setPage(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openArtwork(artwork) {
    setSelectedArtwork(artwork);
  }

  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="#home"
          onClick={(event) => {
            event.preventDefault();
            showCollection();
          }}
        >
          <span className="brand-mark">M.</span>
          <span>MUSEUM ARCHIVE</span>
        </a>

        <nav className="top-nav">
          <button
            className={activeView === "collection" ? "nav-active" : ""}
            onClick={showCollection}
          >
            Koleksiyon
          </button>

          <button
            className={activeView === "favorites" ? "nav-active" : ""}
            onClick={showFavorites}
          >
            Favoriler ({favorites.length})
          </button>
        </nav>
      </header>

      <main id="home">
        <section className="hero">
          <p className="eyebrow">SANATIN İZİNDE BİR KEŞİF</p>

          <h1>
            Sanatı keşfet.
            <br />
            <em>Hikâyeleri keşfet.</em>
          </h1>

          <p className="hero-description">
            Dünyanın dört bir yanından sanat eserlerini keşfet,
            sanatçıları tanı ve kendi koleksiyonunu oluştur.
          </p>

          <form className="search-form" onSubmit={handleSearch}>
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Eser, sanatçı veya anahtar kelime ara..."
              aria-label="Sanat eseri veya sanatçı ara"
            />

            <button type="submit">Keşfet ↗</button>
          </form>

          <p className="source-note">
            The Metropolitan Museum of Art koleksiyonundan
          </p>
        </section>

        {/* YENİ: Öne çıkan eserler */}
        {activeView === "collection" && (
          <section className="featured-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">EDİTÖRÜN SEÇİMİ</p>
                <h2>Öne çıkan eserler</h2>
              </div>

              <span className="results-count">
                Koleksiyondan seçkiler
              </span>
            </div>

            {featuredLoading ? (
              <div className="featured-loading">
                <div className="loader" />
                <p>Özel seçki hazırlanıyor...</p>
              </div>
            ) : featuredArtworks.length > 0 ? (
              <div className="featured-grid">
                {featuredArtworks.slice(0, 4).map((artwork) => (
                  <article
                    className="featured-card"
                    key={artwork.objectID}
                  >
                    <button
                      className="featured-image-button"
                      onClick={() => openArtwork(artwork)}
                      aria-label={`${artwork.title} detaylarını aç`}
                    >
                      <img
                        src={
                          artwork.primaryImageSmall ||
                          artwork.primaryImage
                        }
                        alt={artwork.title || "Öne çıkan eser"}
                        loading="lazy"
                      />
                      <span className="featured-view">
                        Eseri keşfet ↗
                      </span>
                    </button>

                    <div className="featured-card-info">
                      <p>{artwork.objectDate || "Tarih belirtilmemiş"}</p>

                      <button
                        className="featured-title"
                        onClick={() => openArtwork(artwork)}
                      >
                        {artwork.title || "İsimsiz eser"}
                      </button>

                      <button
                        className="featured-artist artist-link"
                        onClick={() =>
                          searchArtist(artwork.artistDisplayName)
                        }
                        disabled={!artwork.artistDisplayName}
                      >
                        {artwork.artistDisplayName ||
                          "Sanatçı bilinmiyor"}
                      </button>

                      <button
                        className={`featured-favorite ${
                          isFavorite(artwork) ? "is-favorite" : ""
                        }`}
                        onClick={() => toggleFavorite(artwork)}
                        aria-label="Favorilere ekle veya çıkar"
                      >
                        {isFavorite(artwork) ? "♥" : "♡"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="featured-fallback">
                Öne çıkan eserler şu anda yüklenemedi. Aşağıdaki
                koleksiyon aramasını kullanabilirsin.
              </p>
            )}
          </section>
        )}

        {/* YENİ: Sanatçı keşfi */}
        {activeView === "collection" && (
          <section className="artist-discovery">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SANATÇILARI TANI</p>
                <h2>Ustaların dünyası</h2>
              </div>
            </div>

            <div className="artist-discovery-grid">
              {FEATURED_ARTISTS.map((artist, index) => (
                <button
                  className="artist-discovery-card"
                  key={artist.name}
                  onClick={() => searchArtist(artist.query)}
                >
                  <span className="artist-number">
                    0{index + 1}
                  </span>

                  <span className="artist-discovery-name">
                    {artist.name}
                  </span>

                  <span className="artist-discovery-description">
                    {artist.description}
                  </span>

                  <span className="artist-discovery-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="collection-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {activeView === "favorites"
                  ? "KİŞİSEL KOLEKSİYONUN"
                  : "KOLEKSİYONU KEŞFET"}
              </p>

              <h2>
                {activeView === "favorites"
                  ? "Favori eserlerin"
                  : "Sanat arşivi"}
              </h2>
            </div>

            {activeView === "collection" && (
              <span className="results-count">
                {totalResults.toLocaleString("tr-TR")} sonuç
              </span>
            )}
          </div>

          {activeView === "collection" && (
            <div className="category-list">
              {categories.map((item) => (
                <button
                  key={item.value}
                  className={
                    category === item.value ? "category-active" : ""
                  }
                  onClick={() => selectCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="tools-row">
            <label className="quick-filter">
              <span aria-hidden="true">⌕</span>

              <input
                value={quickFilter}
                onChange={(event) => setQuickFilter(event.target.value)}
                placeholder="Bu sonuçlarda eser veya sanatçı filtrele..."
                aria-label="Gösterilen eserleri filtrele"
              />

              {quickFilter && (
                <button
                  type="button"
                  onClick={() => setQuickFilter("")}
                  aria-label="Filtreyi temizle"
                >
                  ×
                </button>
              )}
            </label>

            <label className="sort-control">
              <span>Sırala</span>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeView === "collection" && submittedQuery && (
            <p className="filter-summary">
              Arama: “{submittedQuery}”
              {category !== "all" &&
                ` · ${
                  categories.find((item) => item.value === category)
                    ?.label
                }`}
            </p>
          )}

          {loading && (
            <div className="status-message">
              <div className="loader" />
              <p>Sanat eserleri keşfediliyor...</p>
            </div>
          )}

          {!loading && error && (
            <div className="status-message error-message">
              <p>{error}</p>
              <button onClick={() => setRetryKey((value) => value + 1)}>
                Tekrar dene
              </button>
            </div>
          )}

          {!loading && !error && displayedArtworks.length === 0 && (
            <div className="status-message">
              <p>
                {activeView === "favorites"
                  ? "Henüz favorilerine eser eklemedin."
                  : "Bu aramayla eşleşen, görseli bulunan bir eser gösterilemiyor."}
              </p>

              {activeView === "favorites" && (
                <button onClick={showCollection}>
                  Koleksiyona dön
                </button>
              )}
            </div>
          )}

          {!loading && !error && displayedArtworks.length > 0 && (
            <div className="art-grid">
              {displayedArtworks.map((artwork) => (
                <article className="art-card" key={artwork.objectID}>
                  <button
                    className="art-image-button"
                    onClick={() => openArtwork(artwork)}
                    aria-label={`${artwork.title} eserinin detaylarını aç`}
                  >
                    <div className="art-image-wrap">
                      <img
                        src={
                          artwork.primaryImageSmall ||
                          artwork.primaryImage
                        }
                        alt={artwork.title || "Sanat eseri"}
                        loading="lazy"
                      />

                      <span className="view-art">Detayları gör ↗</span>
                    </div>
                  </button>

                  <div className="art-card-info">
                    <div className="art-card-topline">
                      <span>
                        {artwork.objectDate || "Tarih belirtilmemiş"}
                      </span>

                      <button
                        className={`favorite-button ${
                          isFavorite(artwork) ? "is-favorite" : ""
                        }`}
                        onClick={() => toggleFavorite(artwork)}
                        aria-label={
                          isFavorite(artwork)
                            ? "Favorilerden çıkar"
                            : "Favorilere ekle"
                        }
                      >
                        {isFavorite(artwork) ? "♥" : "♡"}
                      </button>
                    </div>

                    <button
                      className="art-title"
                      onClick={() => openArtwork(artwork)}
                    >
                      {artwork.title || "İsimsiz eser"}
                    </button>

                    <button
                      className="art-artist artist-link"
                      onClick={() =>
                        searchArtist(artwork.artistDisplayName)
                      }
                      disabled={!artwork.artistDisplayName}
                    >
                      {artwork.artistDisplayName ||
                        "Sanatçı bilinmiyor"}
                      {artwork.artistDisplayName && <span> ↗</span>}
                    </button>

                    <p className="art-department">
                      {artwork.department || "Koleksiyon eseri"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeView === "collection" &&
            !loading &&
            !error &&
            totalResults > PAGE_SIZE && (
              <div className="pagination">
                <button
                  onClick={() => {
                    setPage((current) => Math.max(0, current - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={page === 0}
                >
                  ← Önceki
                </button>

                <span>
                  Sayfa {page + 1} /{" "}
                  {Math.max(1, Math.ceil(totalResults / PAGE_SIZE))}
                </span>

                <button
                  onClick={() => {
                    setPage((current) => current + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={(page + 1) * PAGE_SIZE >= totalResults}
                >
                  Sonraki →
                </button>
              </div>
            )}
        </section>
      </main>

      <footer className="footer">
        <span className="brand-mark">M.</span>
        <p>Sanat geçmişten bugüne, keşfedilmeyi bekliyor.</p>
        <span>The Metropolitan Museum of Art koleksiyonu</span>
      </footer>

      {selectedArtwork && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedArtwork(null)}
          role="presentation"
        >
          <section
            className="art-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sanat eseri detayları"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedArtwork(null)}
              aria-label="Detayları kapat"
            >
              ×
            </button>

            <div className="modal-image">
              {selectedArtwork.primaryImage ? (
                <img
                  src={selectedArtwork.primaryImage}
                  alt={selectedArtwork.title || "Sanat eseri"}
                />
              ) : (
                <div className="modal-no-image">
                  Görsel mevcut değil
                </div>
              )}
            </div>

            <div className="modal-content">
              <p className="eyebrow">
                {selectedArtwork.department || "Müze koleksiyonu"}
              </p>

              <h2>
                {selectedArtwork.title || "İsimsiz eser"}
              </h2>

              <button
                className="modal-artist artist-link"
                onClick={() =>
                  searchArtist(selectedArtwork.artistDisplayName)
                }
                disabled={!selectedArtwork.artistDisplayName}
              >
                {selectedArtwork.artistDisplayName ||
                  "Sanatçı bilinmiyor"}

                {selectedArtwork.artistDisplayName && (
                  <span> · Bu sanatçının eserlerini ara ↗</span>
                )}
              </button>

              <p className="modal-date">
                {selectedArtwork.objectDate || "Tarih belirtilmemiş"}
              </p>

              <div className="artist-profile">
                <p className="eyebrow">SANATÇI HAKKINDA</p>

                <p>
                  {selectedArtwork.artistDisplayBio ||
                    "Bu eser kaydında sanatçı biyografisi bulunmuyor."}
                </p>

                {selectedArtwork.artistNationality && (
                  <p>
                    <strong>Uyruk:</strong>{" "}
                    {selectedArtwork.artistNationality}
                  </p>
                )}

                {(selectedArtwork.artistBeginDate ||
                  selectedArtwork.artistEndDate) && (
                  <p>
                    <strong>Yaşam yılları:</strong>{" "}
                    {selectedArtwork.artistBeginDate || "?"} –{" "}
                    {selectedArtwork.artistEndDate || "?"}
                  </p>
                )}

                {selectedArtwork.artistWikidata_URL && (
                  <a
                    href={selectedArtwork.artistWikidata_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="external-link"
                  >
                    Sanatçı hakkında daha fazla bilgi ↗
                  </a>
                )}
              </div>

              <div className="detail-list">
                <div>
                  <span>Tarih</span>
                  <strong>{formatValue(selectedArtwork.objectDate)}</strong>
                </div>

                <div>
                  <span>Teknik / Malzeme</span>
                  <strong>{formatValue(selectedArtwork.medium)}</strong>
                </div>

                <div>
                  <span>Kültür</span>
                  <strong>{formatValue(selectedArtwork.culture)}</strong>
                </div>

                <div>
                  <span>Sınıflandırma</span>
                  <strong>
                    {formatValue(selectedArtwork.classification)}
                  </strong>
                </div>

                <div>
                  <span>Dönem</span>
                  <strong>{formatValue(selectedArtwork.period)}</strong>
                </div>

                <div>
                  <span>Boyutlar</span>
                  <strong>{formatValue(selectedArtwork.dimensions)}</strong>
                </div>

                <div>
                  <span>Bölüm</span>
                  <strong>{formatValue(selectedArtwork.department)}</strong>
                </div>

                <div>
                  <span>Envanter numarası</span>
                  <strong>
                    {formatValue(selectedArtwork.accessionNumber)}
                  </strong>
                </div>

                <div>
                  <span>Koleksiyona giriş bilgisi</span>
                  <strong>{formatValue(selectedArtwork.creditLine)}</strong>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="modal-favorite"
                  onClick={() => toggleFavorite(selectedArtwork)}
                >
                  {isFavorite(selectedArtwork)
                    ? "♥ Favorilerden çıkar"
                    : "♡ Favorilere ekle"}
                </button>

                {selectedArtwork.objectURL && (
                  <a
                    className="external-link"
                    href={selectedArtwork.objectURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Müze kaydını aç ↗
                  </a>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
