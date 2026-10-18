(() => {
  const TOTAL_FRAMES = 300;
  const canvas = document.getElementById('scroll-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // Preloaded image storage
  const images = new Array(TOTAL_FRAMES);
  const loaded = new Array(TOTAL_FRAMES).fill(false);
  let loadedCount = 0;

  // Physics & animation states
  let currentY = window.scrollY;
  let targetY = window.scrollY;
  let lastProgrammaticScrollY = Math.round(window.scrollY);
  let currentFrame = 0;
  let targetFrame = 0;
  let lastDrawnFrame = -1;
  let maxScroll = 1;
  let dpr = 1;

  function getFrameUrl(index) {
    const frameNum = String(index + 1).padStart(3, '0');
    return `frames/ezgif-frame-${frameNum}.jpg`;
  }

  // Preload all frames with priority on frame 0 and async GPU decoding
  function preloadImages() {
    // 1. Frame 0 priority
    const firstImg = new Image();
    firstImg.decoding = 'async';
    firstImg.src = getFrameUrl(0);
    images[0] = firstImg;
    firstImg.onload = () => {
      loaded[0] = true;
      loadedCount++;
      if (firstImg.decode) {
        firstImg.decode().then(render).catch(render);
      } else {
        render();
      }
    };

    // 2. Preload remaining frames
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = getFrameUrl(i);
      img.onload = () => {
        loaded[i] = true;
        loadedCount++;
        if (img.decode) {
          img.decode().catch(() => {});
        }
      };
      images[i] = img;
    }
  }

  // Return best available frame (nearest fallback if target still buffering)
  function getLoadedImage(index) {
    if (loaded[index] && images[index]?.complete && images[index].naturalWidth > 0) {
      return images[index];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const down = index - offset;
      if (down >= 0 && loaded[down] && images[down]?.complete && images[down].naturalWidth > 0) {
        return images[down];
      }
      const up = index + offset;
      if (up < TOTAL_FRAMES && loaded[up] && images[up]?.complete && images[up].naturalWidth > 0) {
        return images[up];
      }
    }
    return null;
  }

  // Responsive retina resize
  function resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    dpr = Math.min(Math.max(1, pixelRatio), 3);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    lastDrawnFrame = -1;
    render();
  }

  // Draw frame to canvas with exact pixel alignment (crystal sharp, zero blur)
  function render() {
    const frameIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));
    const img = getLoadedImage(frameIdx);
    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Fill canvas background
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, cw, ch);

    // Calculate aspect ratio scaling in native canvas pixels
    let scale;
    if (cw / ch >= iw / ih) {
      scale = ch / ih;
    } else {
      scale = Math.min(cw / (650 * dpr), (ch * 0.9) / ih);
    }

    // Exact integer coordinates eliminate bilinear subpixel blur
    const dw = Math.round(iw * scale);
    const dh = Math.round(ih * scale);
    const dx = Math.round((cw - dw) / 2);
    const dy = Math.round((ch - dh) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);

    lastDrawnFrame = frameIdx;
  }

  // Smooth wheel listener with inertia
  window.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 33;
      else if (e.deltaMode === 2) delta *= window.innerHeight;

      targetY = Math.max(0, Math.min(maxScroll, targetY + delta));
    },
    { passive: false }
  );

  // Sync scroll on manual scrollbar drag, touch gesture, or keys
  window.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - lastProgrammaticScrollY) > 2) {
      targetY = window.scrollY;
      currentY = window.scrollY;
    }
    updateActiveNav();
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    const pageStep = window.innerHeight * 0.6;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetY = Math.min(maxScroll, targetY + 90);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetY = Math.max(0, targetY - 90);
    } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
      e.preventDefault();
      targetY = Math.min(maxScroll, targetY + pageStep);
    } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
      e.preventDefault();
      targetY = Math.max(0, targetY - pageStep);
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetY = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetY = maxScroll;
    }
  });

  // Smooth anchor navigation
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const el = document.querySelector(targetId);
        if (el) {
          e.preventDefault();
          maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          const targetOffset = el.getBoundingClientRect().top + window.scrollY - 80;
          targetY = Math.max(0, Math.min(maxScroll, targetOffset));
        }
      }
    });
  });

  // Service cards interactive accordion highlight
  const serviceCards = document.querySelectorAll('.service-card');
  serviceCards.forEach((card) => {
    card.addEventListener('click', () => {
      serviceCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Pricing cards interactive select
  const pricingCards = document.querySelectorAll('.pricing-card');
  pricingCards.forEach((card) => {
    card.addEventListener('click', () => {
      pricingCards.forEach((c) => c.classList.remove('active', 'pricing-card-featured'));
      card.classList.add('active', 'pricing-card-featured');
    });
  });

  // Pricing monthly/yearly toggle switch
  const pricingToggle = document.getElementById('pricing-toggle');
  if (pricingToggle) {
    pricingToggle.addEventListener('change', () => {
      const isYearly = pricingToggle.checked;
      document.querySelectorAll('.price-val').forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-4px)';
        setTimeout(() => {
          el.textContent = isYearly ? el.dataset.yearly : el.dataset.monthly;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 120);
      });
    });
  }

  const localTime = document.getElementById('local-time');
  const localTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Etc/GMT+4',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  function updateLocalTime() {
    const now = new Date();
    localTime.dateTime = now.toISOString();
    localTime.textContent = localTimeFormatter.format(now);
  }

  if (localTime) {
    updateLocalTime();
    window.setInterval(updateLocalTime, 1000);
  }

  const navbar = document.querySelector('.navbar');
  const menuButton = document.querySelector('.nav-menu-btn');
  const primaryNavigation = document.getElementById('primary-navigation');

  function setMenuOpen(isOpen) {
    navbar.classList.toggle('menu-open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.querySelector('span').textContent = isOpen ? 'Close' : 'Menu';
  }

  menuButton.addEventListener('click', () => {
    setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  primaryNavigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(false);
      menuButton.focus();
    }
  });

  // Highlight active navbar link based on scroll section
  function updateActiveNav() {
    const sections = ['home', 'about', 'services', 'pricing', 'contact'];
    const navLinks = document.querySelectorAll('.nav-link');
    let currentSection = 'home';

    sections.forEach((secId) => {
      const secEl = document.getElementById(secId);
      if (secEl) {
        const rect = secEl.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.4) {
          currentSection = secId;
        }
      }
    });

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === `#${currentSection}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Animation loop with dual LERP for ultra-smooth scrolling
  function animate() {
    // 1. Smooth scroll position
    const scrollDiff = targetY - currentY;
    if (Math.abs(scrollDiff) > 0.05) {
      currentY += scrollDiff * 0.085;
      lastProgrammaticScrollY = Math.round(currentY);
      window.scrollTo(0, currentY);
    } else if (currentY !== targetY) {
      currentY = targetY;
      lastProgrammaticScrollY = Math.round(currentY);
      window.scrollTo(0, currentY);
    }

    // 2. Smooth frame interpolation
    const scrollProgress = Math.max(0, Math.min(1, currentY / (maxScroll || 1)));
    targetFrame = scrollProgress * (TOTAL_FRAMES - 1);

    const frameDiff = targetFrame - currentFrame;
    if (Math.abs(frameDiff) > 0.001) {
      currentFrame += frameDiff * 0.22;
    } else {
      currentFrame = targetFrame;
    }

    const frameToDraw = Math.round(currentFrame);
    if (frameToDraw !== lastDrawnFrame) {
      render();
    }

    renderParticles();
    requestAnimationFrame(animate);
  }

  // Ambient floating embers particle system
  const particleCanvas = document.getElementById('ambient-particles');
  const pCtx = particleCanvas ? particleCanvas.getContext('2d') : null;
  const PARTICLE_COUNT = 36;
  const particles = [];

  function initParticles() {
    if (!particleCanvas) return;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 1.8 + 0.6,
        speedY: Math.random() * 0.35 + 0.12,
        speedX: (Math.random() - 0.5) * 0.22,
        alpha: Math.random() * 0.55 + 0.2,
        pulseSpeed: Math.random() * 0.02 + 0.008,
        pulse: Math.random() * Math.PI,
        color: Math.random() > 0.35 ? '255, 60, 70' : '255, 140, 80'
      });
    }
  }

  function renderParticles() {
    if (!pCtx) return;
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    const h = particleCanvas.height;
    const w = particleCanvas.width;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y -= p.speedY;
      p.x += p.speedX;
      p.pulse += p.pulseSpeed;

      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      const currentAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));

      // Crisp core
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      pCtx.fillStyle = `rgba(${p.color}, ${currentAlpha})`;
      pCtx.fill();

      // Soft ambient aura without CPU shadow blur
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
      pCtx.fillStyle = `rgba(${p.color}, ${currentAlpha * 0.22})`;
      pCtx.fill();
    }
  }

  // Initialization
  function onResize() {
    resize();
    if (particleCanvas) {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    }
  }

  window.addEventListener('resize', onResize);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      preloadImages();
      initParticles();
      resize();
      requestAnimationFrame(animate);
    });
  } else {
    preloadImages();
    initParticles();
    resize();
    requestAnimationFrame(animate);
  }
})();
