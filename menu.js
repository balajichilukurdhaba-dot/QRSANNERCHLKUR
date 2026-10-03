/**
 * Balaji Chilukur Family Dhaba - Smooth Interactive Menu
 * Designed for 60fps/120fps fluid scrolling on all mobile and desktop devices.
 */

(function () {
  'use strict';

  // --- State Management ---
  const state = {
    activeCategory: 'all',
    activeFilter: null, // null | 'special' | 'popular'
    searchQuery: '',
    expandedCategories: new Set(),
    isManualScrolling: false,
    manualScrollTimer: null
  };

  // --- DOM Elements ---
  const elements = {
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    categoryChipsScroll: document.getElementById('category-chips-scroll'),
    specialFilterBtn: document.getElementById('filter-special-btn'),
    popularFilterBtn: document.getElementById('filter-popular-btn'),
    menuSectionsContainer: document.getElementById('menu-sections-container'),
    searchStatusBar: document.getElementById('search-status-bar'),
    searchResultCount: document.getElementById('search-result-count'),
    resetSearchLink: document.getElementById('reset-search-link'),
    noResults: document.getElementById('no-results'),
    backToTopBtn: document.getElementById('back-to-top-btn'),

    // Modal elements
    dishModal: document.getElementById('dish-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalImg: document.getElementById('modal-img'),
    modalTitle: document.getElementById('modal-title'),
    modalTelugu: document.getElementById('modal-telugu'),
    modalCategory: document.getElementById('modal-category'),
    modalBadgesContainer: document.getElementById('modal-badges-container'),
    modalDescription: document.getElementById('modal-description')
  };

  const sections = Array.from(document.querySelectorAll('.catalogue-category-section'));
  const allCards = Array.from(document.querySelectorAll('.dish-card'));

  // --- 1. Category Chips & Horizontal Scrolling ---
  function updateActiveChip(catId, shouldCenter = false) {
    if (!elements.categoryChipsScroll) return;
    const chips = elements.categoryChipsScroll.querySelectorAll('.category-chip');
    chips.forEach(chip => {
      const match = chip.getAttribute('data-category') === catId;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-selected', match ? 'true' : 'false');
      if (match && shouldCenter) {
        centerChipInCarousel(chip);
      }
    });
  }

  function centerChipInCarousel(chip) {
    const container = elements.categoryChipsScroll;
    if (!container || !chip) return;
    const chipLeft = chip.offsetLeft;
    const chipWidth = chip.offsetWidth;
    const targetScroll = chipLeft - (container.offsetWidth / 2) + (chipWidth / 2);
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
  }

  function selectCategory(catId) {
    state.activeCategory = catId;
    updateActiveChip(catId, true);

    state.isManualScrolling = true;
    clearTimeout(state.manualScrollTimer);
    state.manualScrollTimer = setTimeout(() => {
      state.isManualScrolling = false;
    }, 850);

    // If search or quick filters were active, reset them to restore all sections
    if (state.searchQuery || state.activeFilter) {
      state.searchQuery = '';
      state.activeFilter = null;
      if (elements.searchInput) elements.searchInput.value = '';
      if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';
      if (elements.specialFilterBtn) elements.specialFilterBtn.classList.remove('active');
      if (elements.popularFilterBtn) elements.popularFilterBtn.classList.remove('active');
      applyFilters();
    }

    if (catId === 'all') {
      const target = document.getElementById('sticky-nav-bar') || document.getElementById('main-content');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      const targetSec = document.getElementById(`section-${catId}`);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function setupCategoryChips() {
    if (!elements.categoryChipsScroll) return;
    const chips = elements.categoryChipsScroll.querySelectorAll('.category-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const catId = chip.getAttribute('data-category');
        selectCategory(catId);
      });
    });
  }

  // --- 2. Smooth Lightweight Scrollspy (Zero Layout Thrashing) ---
  let scrollTicking = false;
  let chipCenterTimer = null;

  function handleCategoryScrollspy() {
    if (state.isManualScrolling) return;
    if (state.searchQuery || state.activeFilter) return;
    if (!sections.length) return;

    const stickyBar = document.getElementById('sticky-nav-bar');
    const stickyBottom = stickyBar ? stickyBar.getBoundingClientRect().bottom : 110;
    const triggerPoint = stickyBottom + 30;

    const firstSection = sections[0];
    const firstRect = firstSection.getBoundingClientRect();
    if (firstRect.top > triggerPoint) {
      if (state.activeCategory !== 'all') {
        state.activeCategory = 'all';
        updateActiveChip('all', false);
      }
      return;
    }

    let activeCatId = 'all';
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const rect = sec.getBoundingClientRect();
      if (rect.top <= triggerPoint) {
        activeCatId = sec.getAttribute('data-category-id') || sec.id.replace('section-', '');
      } else {
        break;
      }
    }

    if (activeCatId && activeCatId !== state.activeCategory) {
      state.activeCategory = activeCatId;
      updateActiveChip(activeCatId, false);

      // Gently center chip in the carousel only after scroll pauses
      clearTimeout(chipCenterTimer);
      chipCenterTimer = setTimeout(() => {
        if (!state.isManualScrolling) {
          const activeChip = elements.categoryChipsScroll?.querySelector(`.category-chip[data-category="${activeCatId}"]`);
          if (activeChip) centerChipInCarousel(activeChip);
        }
      }, 150);
    }
  }

  // --- 3. Filtering & Search Logic ---
  function applyFilters() {
    const query = state.searchQuery.toLowerCase().trim();
    const isSearching = query.length > 0;
    const hasFilter = Boolean(state.activeFilter);
    const isFilteredOrSearch = isSearching || hasFilter;

    let totalVisibleDishes = 0;

    sections.forEach(section => {
      const catId = section.getAttribute('data-category-id');
      const track = document.getElementById(`track-${catId}`);
      const sectionCards = Array.from(section.querySelectorAll('.dish-card'));
      const expandBtn = section.querySelector('.category-expand-btn');

      let visibleInSec = 0;

      sectionCards.forEach(card => {
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const telugu = (card.getAttribute('data-telugu') || '').toLowerCase();
        const desc = (card.getAttribute('data-desc') || '').toLowerCase();
        const category = (card.getAttribute('data-category') || '').toLowerCase();
        const isSpecial = card.getAttribute('data-special') === 'true';
        const isPopular = card.getAttribute('data-popular') === 'true';

        let matches = true;

        if (state.activeFilter === 'special' && !isSpecial) matches = false;
        if (state.activeFilter === 'popular' && !isPopular) matches = false;

        if (matches && isSearching) {
          const matchQuery = title.includes(query) || telugu.includes(query) || desc.includes(query) || category.includes(query);
          if (!matchQuery) matches = false;
        }

        if (matches) {
          // If searching or filter is active, show all matching cards including extra
          if (isFilteredOrSearch) {
            card.style.display = '';
            visibleInSec++;
            totalVisibleDishes++;
          } else {
            // Normal curated row view vs expanded
            const isExtra = card.classList.contains('extra-dish');
            const isExpanded = state.expandedCategories.has(catId);
            if (isExtra && !isExpanded) {
              card.style.display = 'none';
            } else {
              card.style.display = '';
              visibleInSec++;
              totalVisibleDishes++;
            }
          }
        } else {
          card.style.display = 'none';
        }
      });

      if (visibleInSec === 0) {
        section.style.display = 'none';
      } else {
        section.style.display = 'block';

        if (isFilteredOrSearch) {
          if (track) {
            track.classList.add('catalogue-grid-view');
            track.classList.remove('catalogue-row-track');
          }
          if (expandBtn) expandBtn.style.display = 'none';
        } else {
          const isExpanded = state.expandedCategories.has(catId);
          if (track) {
            if (isExpanded) {
              track.classList.add('catalogue-grid-view');
              track.classList.remove('catalogue-row-track');
            } else {
              track.classList.remove('catalogue-grid-view');
              track.classList.add('catalogue-row-track');
            }
          }
          if (expandBtn) {
            expandBtn.style.display = '';
            expandBtn.classList.toggle('expanded', isExpanded);
            const spanText = expandBtn.querySelector('span');
            if (spanText) {
              spanText.textContent = isExpanded
                ? 'Show Curated Row'
                : `View All ${sectionCards.length} ${section.querySelector('.category-title').textContent} Dishes`;
            }
          }
        }
      }
    });

    if (elements.searchStatusBar) {
      if (isFilteredOrSearch) {
        elements.searchStatusBar.style.display = 'flex';
        if (elements.searchResultCount) {
          elements.searchResultCount.textContent = `Found ${totalVisibleDishes} ${totalVisibleDishes === 1 ? 'dish' : 'dishes'}`;
        }
      } else {
        elements.searchStatusBar.style.display = 'none';
      }
    }

    if (elements.noResults) {
      elements.noResults.style.display = totalVisibleDishes === 0 ? 'flex' : 'none';
    }
  }

  function setupSearchAndFilters() {
    let debounceTimer;

    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        state.searchQuery = e.target.value;

        if (elements.searchClearBtn) {
          elements.searchClearBtn.style.display = state.searchQuery.length > 0 ? 'block' : 'none';
        }

        debounceTimer = setTimeout(applyFilters, 100);
      });
    }

    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener('click', () => {
        if (elements.searchInput) elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClearBtn.style.display = 'none';
        applyFilters();
        if (elements.searchInput) elements.searchInput.focus();
      });
    }

    if (elements.resetSearchLink) {
      elements.resetSearchLink.addEventListener('click', () => {
        if (elements.searchInput) elements.searchInput.value = '';
        state.searchQuery = '';
        state.activeFilter = null;
        state.activeCategory = 'all';
        if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';
        if (elements.specialFilterBtn) elements.specialFilterBtn.classList.remove('active');
        if (elements.popularFilterBtn) elements.popularFilterBtn.classList.remove('active');
        updateActiveChip('all', true);
        applyFilters();
      });
    }

    if (elements.specialFilterBtn) {
      elements.specialFilterBtn.addEventListener('click', () => {
        if (state.activeFilter === 'special') {
          state.activeFilter = null;
          elements.specialFilterBtn.classList.remove('active');
        } else {
          state.activeFilter = 'special';
          elements.specialFilterBtn.classList.add('active');
          if (elements.popularFilterBtn) elements.popularFilterBtn.classList.remove('active');
        }
        applyFilters();
      });
    }

    if (elements.popularFilterBtn) {
      elements.popularFilterBtn.addEventListener('click', () => {
        if (state.activeFilter === 'popular') {
          state.activeFilter = null;
          elements.popularFilterBtn.classList.remove('active');
        } else {
          state.activeFilter = 'popular';
          elements.popularFilterBtn.classList.add('active');
          if (elements.specialFilterBtn) elements.specialFilterBtn.classList.remove('active');
        }
        applyFilters();
      });
    }
  }

  // --- 4. Expand / Collapse Rows ---
  function setupExpandButtons() {
    const expandBtns = document.querySelectorAll('.category-expand-btn');
    expandBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-category-expand');
        const track = document.getElementById(`track-${catId}`);
        const sec = document.getElementById(`section-${catId}`);
        const extraDishes = sec ? sec.querySelectorAll('.extra-dish') : [];
        const isExpanded = state.expandedCategories.has(catId);

        if (isExpanded) {
          state.expandedCategories.delete(catId);
          if (track) {
            track.classList.remove('catalogue-grid-view');
            track.classList.add('catalogue-row-track');
          }
          extraDishes.forEach(c => c.style.display = 'none');
          btn.classList.remove('expanded');
          btn.setAttribute('aria-expanded', 'false');
          const spanText = btn.querySelector('span');
          const catTitle = sec ? sec.querySelector('.category-title').textContent : '';
          const count = sec ? sec.querySelectorAll('.dish-card').length : '';
          if (spanText) spanText.textContent = `View All ${count} ${catTitle} Dishes`;
        } else {
          state.expandedCategories.add(catId);
          if (track) {
            track.classList.add('catalogue-grid-view');
            track.classList.remove('catalogue-row-track');
          }
          extraDishes.forEach(c => c.style.display = '');
          btn.classList.add('expanded');
          btn.setAttribute('aria-expanded', 'true');
          const spanText = btn.querySelector('span');
          if (spanText) spanText.textContent = 'Show Curated Row';
        }
      });
    });
  }

  // --- 5. Dish Detail Modal ---
  function openDishModal(card) {
    if (!elements.dishModal) return;

    const title = card.getAttribute('data-title') || '';
    const telugu = card.getAttribute('data-telugu') || '';
    const desc = card.getAttribute('data-desc') || '';
    const category = card.getAttribute('data-category') || '';
    const img = card.getAttribute('data-img') || '';
    const isSpecial = card.getAttribute('data-special') === 'true';
    const isPopular = card.getAttribute('data-popular') === 'true';

    elements.modalImg.src = img;
    elements.modalImg.alt = title;
    elements.modalTitle.textContent = title;
    elements.modalCategory.textContent = category;

    if (telugu) {
      elements.modalTelugu.textContent = telugu;
      elements.modalTelugu.style.display = 'block';
    } else {
      elements.modalTelugu.style.display = 'none';
    }

    elements.modalDescription.textContent = desc || 'Authentic traditional recipe prepared with fresh farm ingredients and aromatic spices.';

    let badgesHtml = `
      <span class="hero-top-badge" style="margin-bottom:0; padding:4px 12px; font-size:0.75rem;">
        <span class="veg-mark"><span class="dot"></span></span>
        100% Pure Veg
      </span>
    `;

    if (isSpecial) {
      badgesHtml += `<span class="badge-tag badge-chef-special">★ Chef Special</span>`;
    }
    if (isPopular && !isSpecial) {
      badgesHtml += `<span class="badge-tag badge-popular">🔥 Popular</span>`;
    }

    elements.modalBadgesContainer.innerHTML = badgesHtml;

    elements.dishModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    elements.dishModal.focus();
  }

  function closeDishModal() {
    if (!elements.dishModal) return;
    elements.dishModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function setupDishCards() {
    allCards.forEach(card => {
      card.addEventListener('click', () => openDishModal(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDishModal(card);
        }
      });
    });

    if (elements.modalCloseBtn) {
      elements.modalCloseBtn.addEventListener('click', closeDishModal);
    }

    if (elements.dishModal) {
      elements.dishModal.addEventListener('click', (e) => {
        if (e.target === elements.dishModal) {
          closeDishModal();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.dishModal && elements.dishModal.classList.contains('active')) {
        closeDishModal();
      }
    });
  }

  // --- 6. Unified Scroll Handler (Passively Throttled) ---
  function setupScrollHandlers() {
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(() => {
          // Back to top button
          if (elements.backToTopBtn) {
            elements.backToTopBtn.classList.toggle('visible', window.scrollY > 400);
          }
          // Category Scrollspy
          handleCategoryScrollspy();
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });

    if (elements.backToTopBtn) {
      elements.backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // --- Initialization ---
  function init() {
    setupCategoryChips();
    setupSearchAndFilters();
    setupExpandButtons();
    setupDishCards();
    setupScrollHandlers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
