const MOCK_IDENTIFICATIONS = [
  {
    id: "glt-001",
    name: "Charizard ex Special Illustration Rare",
    category: "Trading Card",
    series: "Pokemon 151",
    confidence: 94,
    condition: "Near Mint candidate",
    action: "Grade",
    marketplace: "eBay",
    explanation:
      "High collector demand and clean visible edges make grading the best upside path before selling.",
    art:
      "linear-gradient(145deg, rgba(255,255,255,.3), transparent 42%), linear-gradient(160deg, #ffca52, #f24b7a 45%, #6b38ff)"
  },
  {
    id: "glt-002",
    name: "Blue-Eyes White Dragon Unlimited",
    category: "Trading Card",
    series: "Legend of Blue Eyes",
    confidence: 87,
    condition: "Light edge wear",
    action: "Watch",
    marketplace: "TCGplayer",
    explanation:
      "The match is strong, but condition and print details need a closer look before committing to a listing.",
    art:
      "radial-gradient(circle at 50% 30%, #ffffff 0 8%, transparent 9%), linear-gradient(150deg, #22d3ee, #5263ff 52%, #101827)"
  },
  {
    id: "glt-003",
    name: "Spider-Man 2099 First Appearance",
    category: "Comic",
    series: "Amazing Spider-Man",
    confidence: 82,
    condition: "Mid-grade placeholder",
    action: "Hold",
    marketplace: "eBay",
    explanation:
      "Character momentum is positive, and recent comps suggest patience may beat a quick sale.",
    art:
      "linear-gradient(145deg, rgba(255,255,255,.24), transparent 42%), linear-gradient(155deg, #ff4343, #2b2b66 48%, #17151f)"
  },
  {
    id: "glt-004",
    name: "Sealed Booster Pack Shadow Era",
    category: "Sealed Product",
    series: "Vintage TCG",
    confidence: 76,
    condition: "Sealed / unverified",
    action: "Bundle",
    marketplace: "Whatnot",
    explanation:
      "Standalone value is modest, but pairing it with nearby sealed packs could raise conversion.",
    art:
      "linear-gradient(145deg, rgba(255,255,255,.24), transparent 46%), linear-gradient(155deg, #27e59f, #2a343c 46%, #b14cff)"
  },
  {
    id: "glt-005",
    name: "Galaxy Knight Vinyl Chase",
    category: "Figure",
    series: "Collector Con Exclusive",
    confidence: 91,
    condition: "Display-ready",
    action: "Sell",
    marketplace: "Shopify",
    explanation:
      "Recent sell-through is strong, and the premium chase variant should move quickly as a single listing.",
    art:
      "radial-gradient(circle at 50% 32%, rgba(255,255,255,.9) 0 9%, transparent 10%), linear-gradient(145deg, #111116, #7c3cff 52%, #ff6bd6)"
  }
];

const MOCK_MARKET_VALUES = {
  "glt-001": { value: 184, low: 152, high: 228 },
  "glt-002": { value: 72, low: 48, high: 118 },
  "glt-003": { value: 96, low: 64, high: 140 },
  "glt-004": { value: 43, low: 31, high: 62 },
  "glt-005": { value: 58, low: 42, high: 81 }
};

const BULK_MOCK_CATEGORIES = ["Trading Card", "Comic", "Sealed Product", "Figure"];
const BULK_MOCK_ACTIONS = ["Sell", "Hold", "Grade", "Bundle", "Watch"];

const ONBOARDING_KEY = "glitch.onboarding.complete";

const GlitchAdapters = {
  auth: window.GlitchSupabaseAdapter,
  recognition: {
    async identifyPhotos(photos) {
      await wait(260);
      const requestedCount = photos.length >= 8 ? 42 : Math.max(3, Math.min(12, photos.length + 2));
      return Array.from({ length: requestedCount }, (_, index) => {
        const base = MOCK_IDENTIFICATIONS[index % MOCK_IDENTIFICATIONS.length];
        const category = photos.length >= 8 ? BULK_MOCK_CATEGORIES[index % BULK_MOCK_CATEGORIES.length] : base.category;
        const action = photos.length >= 8 ? BULK_MOCK_ACTIONS[index % BULK_MOCK_ACTIONS.length] : base.action;
        return {
          ...base,
          id: `${base.id}-${Date.now()}-${index}`,
          name: photos.length >= 8 ? `${base.name} #${index + 1}` : base.name,
          category,
          action,
          confidence: Math.max(68, Math.min(98, base.confidence - (index % 9))),
          sourcePhotoName: photos[index % photos.length]?.name || "demo-photo.jpg",
          baseMockId: base.id
        };
      });
    }
  },
  valueEngine: {
    async enrichItems(items) {
      await wait(260);
      return items.map((item) => ({
        ...item,
        ...scaleMarketValue(MOCK_MARKET_VALUES[item.baseMockId], item.id),
        recommendationReason: getRecommendationReason(item.action)
      }));
    }
  },
  inventoryRepository: {
    async saveApprovedItems(existingItems, approvedItems) {
      if (GlitchAdapters.auth?.isConfigured() && state.session) {
        const user = getCurrentUser();
        const rows = approvedItems.map((item) => ({
          user_id: user.id,
          name: item.name,
          category: item.category,
          series: item.series,
          estimated_value: item.value,
          low_value: item.low,
          high_value: item.high,
          confidence: item.confidence,
          condition_estimate: item.condition,
          recommended_action: item.action,
          marketplace_source: item.marketplace,
          ai_explanation: item.explanation,
          photo_url: item.storage?.url || item.photoUrl || null,
          photo_path: item.storage?.path || item.photoPath || null
        }));
        const inserted = await GlitchAdapters.auth.insertInventoryItems(rows);
        const uuidIds = approvedItems
          .map((item) => item.id)
          .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
        await GlitchAdapters.auth.deleteReviewItems(uuidIds);
        return [...existingItems, ...normalizeSupabaseItems(inserted)];
      }
      await wait(120);
      const existingIds = new Set(existingItems.map((item) => item.id));
      return [...existingItems, ...approvedItems.filter((item) => !existingIds.has(item.id))];
    }
  }
};

const state = {
  page: "dashboard",
  session: null,
  profile: null,
  authMode: "signin",
  queue: [],
  inventory: [],
  uploadedPhotos: [],
  activeFilter: "All",
  searchQuery: "",
  reviewFilter: "All",
  lastInventorySummary: null,
  batch: {
    selected: 0,
    uploadProgress: 0,
    analysisProgress: "Idle",
    identified: 0,
    unknown: 0,
    estimatedValue: 0
  },
  selectedItem: null,
  previousPage: "inventory",
  isAnalyzing: false,
  isApproving: false,
  uploadPromise: null,
  storageHealth: null
};

const pages = {
  dashboard: document.querySelector("#dashboardPage"),
  scan: document.querySelector("#scanPage"),
  review: document.querySelector("#reviewPage"),
  inventory: document.querySelector("#inventoryPage"),
  detail: document.querySelector("#detailPage"),
  profile: document.querySelector("#profilePage"),
  settings: document.querySelector("#settingsPage")
};

const pageTitles = {
  dashboard: "Dashboard",
  scan: "Photo Dump",
  review: "Review Queue",
  inventory: "Inventory",
  detail: "Item Detail",
  profile: "Profile",
  settings: "Settings"
};

const authShell = document.querySelector("#authShell");
const onboardingOverlay = document.querySelector("#onboardingOverlay");
const onboardingStartButton = document.querySelector("#onboardingStartButton");
const appShell = document.querySelector("#appShell");
const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authDisplayName = document.querySelector("#authDisplayName");
const authSubmit = document.querySelector("#authSubmit");
const authMessage = document.querySelector("#authMessage");
const titleEl = document.querySelector("#pageTitle");
const backButton = document.querySelector(".back-button");
const quickAddButton = document.querySelector("#quickAddButton");
const quickAddMenu = document.querySelector("#quickAddMenu");
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const analyzeButton = document.querySelector("#analyzeButton");
const sampleScanButton = document.querySelector("#sampleScanButton");
const analysisPanel = document.querySelector("#analysisPanel");
const analysisText = document.querySelector("#analysisText");
const scanProgressBar = document.querySelector("#scanProgressBar");
const scanConfidence = document.querySelector("#scanConfidence");
const scanSuccess = document.querySelector("#scanSuccess");
const uploadStatus = document.querySelector("#uploadStatus");
const inventorySearch = document.querySelector("#inventorySearch");
const reviewQueue = document.querySelector("#reviewQueue");
const inventoryList = document.querySelector("#inventoryList");
const inventorySummary = document.querySelector("#inventorySummary");
const recentInventory = document.querySelector("#recentInventory");
const detailContent = document.querySelector("#detailContent");
const emptyTemplate = document.querySelector("#emptyStateTemplate");
const dropZone = document.querySelector("#dropZone");
const profileForm = document.querySelector("#profileForm");
const profileUsername = document.querySelector("#profileUsername");
const profileDisplayName = document.querySelector("#profileDisplayName");
const profileAvatarUrl = document.querySelector("#profileAvatarUrl");
const profileBio = document.querySelector("#profileBio");
const profileAvatarPreview = document.querySelector("#profileAvatarPreview");
const profileDisplayLabel = document.querySelector("#profileDisplayLabel");
const profileEmailLabel = document.querySelector("#profileEmailLabel");
const profileCollectionCount = document.querySelector("#profileCollectionCount");
const supabaseStatus = document.querySelector("#supabaseStatus");
const settingsProfileStatus = document.querySelector("#settingsProfileStatus");
const storageStatus = document.querySelector("#storageStatus");
const productionSafetyStatus = document.querySelector("#productionSafetyStatus");
const appVersion = document.querySelector("#appVersion");
const signOutButton = document.querySelector("#signOutButton");
const batchSelected = document.querySelector("#batchSelected");
const batchUpload = document.querySelector("#batchUpload");
const batchAnalysis = document.querySelector("#batchAnalysis");
const batchIdentified = document.querySelector("#batchIdentified");
const batchUnknown = document.querySelector("#batchUnknown");
const batchValue = document.querySelector("#batchValue");
const rejectAllButton = document.querySelector("#rejectAllButton");

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

bindEvents();
initializeApp();

function bindEvents() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });

  authForm.addEventListener("submit", handleAuthSubmit);
  onboardingStartButton.addEventListener("click", () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onboardingOverlay.classList.add("hidden");
    navigate("scan");
  });

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });
  document.querySelectorAll("[data-bulk-scan]").forEach((button) => {
    button.addEventListener("click", startBulkScanDemo);
  });

  quickAddButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !quickAddMenu.classList.contains("hidden");
    setQuickAddOpen(!isOpen);
  });

  quickAddMenu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-quick-action]")?.dataset.quickAction;
    if (!action) return;
    setQuickAddOpen(false);
    if (action === "scan") {
      navigate("scan");
      return;
    }
    if (action === "upload") {
      navigate("scan");
      window.setTimeout(() => photoInput.click(), 80);
      return;
    }
    showToast("Manual Entry is planned after scan review is tight");
  });

  document.addEventListener("click", () => setQuickAddOpen(false));

  backButton.addEventListener("click", () => {
    state.selectedItem = null;
    navigate(state.previousPage || "inventory");
  });

  photoInput.addEventListener("change", (event) => {
    setUploadedPhotos(Array.from(event.target.files || []));
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    const files = droppedFiles.filter((file) => file.type.startsWith("image/"));
    if (droppedFiles.length && !files.length) {
      showToast("Drop image files to scan");
      return;
    }
    setUploadedPhotos(files);
  });

  analyzeButton.addEventListener("click", runMockAnalysis);
  sampleScanButton.addEventListener("click", scanSampleItem);

  document.querySelector("#approveAllButton").addEventListener("click", async (event) => {
    if (state.isApproving) return;
    if (!state.queue.length) {
      showToast("Queue is already clear");
      return;
    }
    event.currentTarget.disabled = true;
    await approveItems(getVisibleReviewItems().map((item) => item.id));
    navigate("inventory");
  });
  rejectAllButton.addEventListener("click", async () => {
    const ids = getVisibleReviewItems().map((item) => item.id);
    if (!ids.length) {
      showToast("Nothing to reject");
      return;
    }
    await rejectItems(ids);
  });

  document.querySelectorAll("[data-review-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.reviewFilter = chip.dataset.reviewFilter;
      document.querySelectorAll("[data-review-filter]").forEach((item) => {
        item.classList.toggle("active", item === chip);
      });
      renderReview();
    });
  });

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activeFilter = chip.dataset.filter;
      document.querySelectorAll(".filter-chip").forEach((item) => {
        item.classList.toggle("active", item === chip);
      });
      renderInventory();
    });
  });

  inventorySearch.addEventListener("input", (event) => {
    state.searchQuery = event.target.value.trim().toLowerCase();
    renderInventory();
  });

  profileForm.addEventListener("submit", handleProfileSubmit);
  signOutButton.addEventListener("click", handleSignOut);
}

async function initializeApp() {
  appVersion.textContent = `${window.GLITCH_CONFIG?.appVersion || "1.0.0"} (${window.GLITCH_CONFIG?.buildNumber || "1"})`;
  supabaseStatus.textContent = GlitchAdapters.auth?.isConfigured()
    ? "Configured"
    : "Missing config.js keys";
  state.session = await GlitchAdapters.auth.getSession();
  if (!state.session) {
    showAuthShell("Sign in to continue. Supabase configuration is required for App Store-ready auth.");
    return;
  }
  await hydrateAuthenticatedApp();
}

async function hydrateAuthenticatedApp() {
  try {
    await loadProfile();
    await loadDatabaseState();
    await verifyStorageHealth();
  } catch (error) {
    console.error(error);
    showToast("Could not load Supabase data");
  }
  authShell.classList.add("hidden");
  appShell.classList.remove("hidden");
  navigate(state.page || "dashboard");
  renderAll();
  maybeShowOnboarding();
}

function showAuthShell(message) {
  appShell.classList.add("hidden");
  onboardingOverlay.classList.add("hidden");
  authShell.classList.remove("hidden");
  authMessage.textContent = message;
}

function maybeShowOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY) === "true") return;
  onboardingOverlay.classList.remove("hidden");
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  document.querySelector(".password-field").classList.toggle("hidden", mode === "reset");
  document.querySelector(".signup-field").classList.toggle("hidden", mode !== "signup");
  authPassword.required = mode !== "reset";
  authDisplayName.required = mode === "signup";
  authSubmit.textContent =
    mode === "signup" ? "Create Account" : mode === "reset" ? "Send Reset Link" : "Sign In";
  authMessage.textContent =
    mode === "reset"
      ? "Enter your email and Glitch will request a password reset link."
      : "Use your Glitch account to sync inventory and profile data.";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!GlitchAdapters.auth?.isConfigured()) {
    authMessage.textContent = "Supabase is not configured. Update config.js first.";
    return;
  }
  authSubmit.disabled = true;
  try {
    if (state.authMode === "reset") {
      await GlitchAdapters.auth.resetPassword(authEmail.value.trim());
      authMessage.textContent = "Password reset request sent.";
      return;
    }

    const email = authEmail.value.trim();
    const password = authPassword.value;
    const displayName = authDisplayName.value.trim();
    if (state.authMode === "signup") {
      const signUpResult = await GlitchAdapters.auth.signUp(email, password, { display_name: displayName });
      if (!signUpResult?.access_token) {
        authMessage.textContent = "Account created. Confirm your email, then sign in to Glitch.";
        setAuthMode("signin");
        authEmail.value = email;
        return;
      }
      state.session = signUpResult;
    } else {
      state.session = await GlitchAdapters.auth.signIn(email, password);
    }

    await hydrateAuthenticatedApp();
  } catch (error) {
    console.error(error);
    authMessage.textContent = cleanError(error.message);
  } finally {
    authSubmit.disabled = false;
  }
}

async function loadProfile() {
  const user = getCurrentUser();
  if (!user) return;
  let profile = await GlitchAdapters.auth.getProfile(user.id);
  if (!profile) {
    const fallbackName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Collector";
    profile = await GlitchAdapters.auth.upsertProfile({
      id: user.id,
      username: fallbackName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      display_name: fallbackName,
      avatar_url: "",
      bio: "",
      collection_count: 0
    });
  }
  state.profile = profile;
  renderProfile();
}

async function loadDatabaseState() {
  const user = getCurrentUser();
  if (!user) return;
  state.inventory = normalizeSupabaseItems(await GlitchAdapters.auth.listInventory(user.id));
  state.queue = normalizeSupabaseItems(await GlitchAdapters.auth.listReviewQueue(user.id));
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return;
  try {
    state.profile = await GlitchAdapters.auth.upsertProfile({
      id: user.id,
      username: profileUsername.value.trim(),
      display_name: profileDisplayName.value.trim(),
      avatar_url: profileAvatarUrl.value.trim(),
      bio: profileBio.value.trim(),
      collection_count: state.inventory.length
    });
    renderProfile();
    showToast("Profile saved");
  } catch (error) {
    console.error(error);
    showToast("Could not save profile");
  }
}

async function handleSignOut() {
  await GlitchAdapters.auth.signOut();
  state.session = null;
  state.profile = null;
  state.inventory = [];
  state.queue = [];
  showAuthShell("Signed out. Sign in to continue.");
}

async function scanSampleItem() {
  const file = createSampleCollectibleFile();
  setUploadedPhotos([file]);
  showToast("Sample item staged");
  await wait(180);
  runMockAnalysis();
}

async function startBulkScanDemo() {
  navigate("scan");
  const files = Array.from({ length: 12 }, (_, index) => createSampleCollectibleFile(index + 1));
  setUploadedPhotos(files);
  showToast("Bulk collection staged");
  await wait(220);
  runMockAnalysis();
}

async function runMockAnalysis() {
  if (!state.uploadedPhotos.length || state.isAnalyzing) return;

  state.isAnalyzing = true;
  analyzeButton.disabled = true;
  document.body.classList.add("is-scanning");
  reviewQueue.classList.remove("results-ready");
  scanSuccess.classList.add("hidden");
  analysisPanel.classList.remove("hidden");

  const steps = [
    { text: "Reading image clues and extracting collectible signals.", progress: 22, confidence: "AI confidence 42%" },
    { text: "Matching sets, variants, and likely condition bands.", progress: 48, confidence: "AI confidence 68%" },
    { text: "Checking mock market comps and value ranges.", progress: 76, confidence: "AI confidence 84%" },
    { text: "Building confidence scores and action recommendations.", progress: 100, confidence: "AI confidence 93%" }
  ];

  try {
    for (const step of steps) {
      analysisText.textContent = step.text;
      scanProgressBar.style.width = `${step.progress}%`;
      scanConfidence.textContent = step.confidence;
      state.batch.analysisProgress = `${step.progress}%`;
      renderBatchPanel();
      await wait(620);
    }

    if (state.uploadPromise) await state.uploadPromise.catch(() => null);
    state.queue = await identifyAndCreateReviewItems();
    state.batch.identified = state.queue.length;
    state.batch.unknown = state.uploadedPhotos.length >= 8
      ? Math.max(1, Math.round(state.uploadedPhotos.length * 0.25))
      : Math.max(0, state.uploadedPhotos.length - Math.min(state.uploadedPhotos.length, state.queue.length));
    state.batch.estimatedValue = state.queue.reduce((sum, item) => sum + item.value, 0);
    state.batch.analysisProgress = "Complete";
    renderBatchPanel();
    analysisPanel.classList.add("hidden");
    scanSuccess.classList.remove("hidden");
    showToast(`${state.queue.length} collectibles identified`);
    await wait(720);
    scanSuccess.classList.add("hidden");
    navigate("review");
    window.setTimeout(() => reviewQueue.classList.add("results-ready"), 80);
  } catch (error) {
    console.error(error);
    analysisText.textContent = cleanError(error.message);
    scanConfidence.textContent = "Identification paused";
    showToast(cleanError(error.message) || "Analysis could not finish");
  } finally {
    state.isAnalyzing = false;
    document.body.classList.remove("is-scanning");
    analysisPanel.classList.add("hidden");
    scanProgressBar.style.width = "0%";
    scanConfidence.textContent = "AI confidence warming up";
    renderPhotoPreview();
    renderAll();
  }
}

function navigate(page) {
  if (!state.session) {
    showAuthShell("Sign in to access Glitch.");
    return;
  }
  state.page = page;
  Object.entries(pages).forEach(([key, element]) => {
    element.classList.toggle("active", key === page);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    const activeNav = page === "detail" ? "inventory" : page;
    item.classList.toggle("active", item.dataset.nav === activeNav);
  });
  backButton.classList.toggle("hidden", page !== "detail");
  titleEl.textContent = pageTitles[page];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setUploadedPhotos(files) {
  state.uploadedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.uploadedPhotos = files.map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
    file,
    storage: null,
    uploadError: null,
    uploadState: "queued"
  }));
  photoInput.value = "";
  uploadStatus.textContent = state.uploadedPhotos.length
    ? `${state.uploadedPhotos.length} photo${state.uploadedPhotos.length === 1 ? "" : "s"} staged`
    : "Ready for photo dump";
  state.batch = {
    selected: state.uploadedPhotos.length,
    uploadProgress: 0,
    analysisProgress: state.uploadedPhotos.length ? "Ready" : "Idle",
    identified: 0,
    unknown: 0,
    estimatedValue: 0
  };
  renderPhotoPreview();
  renderBatchPanel();
  state.uploadPromise = uploadStagedPhotos();
}

function createSampleCollectibleFile(index = 1) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="#ffca52"/>
          <stop offset=".48" stop-color="#f24b7a"/>
          <stop offset="1" stop-color="#6b38ff"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1200" rx="72" fill="url(#bg)"/>
      <rect x="70" y="70" width="760" height="1060" rx="48" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="8"/>
      <circle cx="450" cy="360" r="150" fill="rgba(255,255,255,.78)"/>
      <text x="450" y="660" text-anchor="middle" font-family="Arial" font-size="78" font-weight="800" fill="white">GLITCH</text>
      <text x="450" y="750" text-anchor="middle" font-family="Arial" font-size="44" font-weight="700" fill="rgba(255,255,255,.86)">Sample Collectible ${index}</text>
    </svg>
  `;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return new File([blob], `glitch-sample-card-${index}.svg`, { type: "image/svg+xml" });
}

async function uploadStagedPhotos() {
  if (!state.session || !GlitchAdapters.auth?.isConfigured() || !state.uploadedPhotos.length) return;
  const user = getCurrentUser();
  if (!user) return;
  uploadStatus.textContent = "Syncing photos to Glitch storage...";
  state.uploadedPhotos.forEach((photo) => {
    if (!photo.storage) photo.uploadState = "uploading";
  });
  renderPhotoPreview();
  await Promise.all(
    state.uploadedPhotos.map(async (photo) => {
      if (photo.storage || photo.uploadError) return;
      try {
        photo.storage = await GlitchAdapters.auth.uploadItemPhoto(user.id, photo.file);
        photo.uploadState = "synced";
      } catch (error) {
        console.error(error);
        photo.uploadError = error.message;
        photo.uploadState = "failed";
      }
    })
  );
  const uploaded = state.uploadedPhotos.filter((photo) => photo.storage).length;
  state.batch.uploadProgress = state.uploadedPhotos.length
    ? Math.round((uploaded / state.uploadedPhotos.length) * 100)
    : 0;
  uploadStatus.textContent = uploaded
    ? `${uploaded} photo${uploaded === 1 ? "" : "s"} synced`
    : `${state.uploadedPhotos.length} photo${state.uploadedPhotos.length === 1 ? "" : "s"} staged`;
  renderPhotoPreview();
  renderBatchPanel();
}

function renderPhotoPreview() {
  photoPreview.innerHTML = "";
  analyzeButton.disabled = state.uploadedPhotos.length === 0 || state.isAnalyzing;

  state.uploadedPhotos.forEach((photo, index) => {
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.dataset.state = photo.uploadState || "queued";
    tile.style.setProperty("--tile-index", index);
    tile.innerHTML = `
      <img src="${photo.url}" alt="${escapeHtml(photo.name)}" />
      <span>${escapeHtml(photo.uploadState || "queued")}</span>
    `;
    photoPreview.append(tile);
  });
}

function renderBatchPanel() {
  if (!batchSelected) return;
  batchSelected.textContent = `${state.batch.selected} photo${state.batch.selected === 1 ? "" : "s"}`;
  batchUpload.textContent = `${state.batch.uploadProgress}%`;
  batchAnalysis.textContent = state.batch.analysisProgress;
  batchIdentified.textContent = state.batch.identified;
  batchUnknown.textContent = state.batch.unknown;
  batchValue.textContent = currency.format(state.batch.estimatedValue);
}

function renderDashboard() {
  const total = state.inventory.reduce((sum, item) => sum + item.value, 0);
  const displayTotal = total || 12840;
  const displayItems = state.inventory.length || 42;
  document.querySelector("#dashTotal").textContent = currency.format(displayTotal);
  document.querySelector("#dashQueue").textContent = state.queue.length;
  document.querySelector("#dashAction").textContent =
    state.inventory.find((item) => item.action === "Sell")?.action ||
    state.inventory[0]?.action ||
    "Scan";
  const firstName = state.profile?.display_name?.split(" ")[0] || "Collector";
  document.querySelector(".summary-greeting span").textContent = `Good Morning, ${firstName}`;
  document.querySelector("#summaryValue").textContent = currency.format(displayTotal);
  document.querySelector("#summaryItems").textContent = displayItems;
  document.querySelector("#summaryWeekly").textContent = "+8.4%";
  document.querySelector("#summaryQueue").textContent = state.queue.length;

  const recent = state.inventory.slice(-3).reverse();
  recentInventory.innerHTML = "";
  if (!recent.length) {
    recentInventory.append(createEmptyState("Scan your first collectible.", "Glitch will identify it, estimate value, and stage it for review.", true));
    return;
  }
  recent.forEach((item) => recentInventory.append(createInventoryRow(item)));
}

function renderReview() {
  reviewQueue.innerHTML = "";
  const visibleItems = getVisibleReviewItems();
  document.querySelector("#approveAllButton").disabled = visibleItems.length === 0 || state.isApproving;
  rejectAllButton.disabled = visibleItems.length === 0 || state.isApproving;
  if (!state.queue.length) {
    reviewQueue.append(createEmptyState("Queue is clear", "Bulk scan photos and Glitch will stage AI results here."));
    return;
  }
  if (!visibleItems.length) {
    reviewQueue.append(createEmptyState("No items in this category", "Choose another category or approve everything visible."));
    return;
  }

  visibleItems.forEach((item) => {
    const card = document.createElement("article");
    const actionDisabled = state.isApproving ? "disabled" : "";
    card.className = "review-card";
    card.dataset.id = item.id;
    card.style.setProperty("--confidence", `${item.confidence}%`);
    card.innerHTML = `
      <div class="review-status-row">
        <span>Pending AI review</span>
        <strong>${item.confidence}% confidence</strong>
      </div>
    ` + itemMarkup(item) + `
      <form class="edit-form hidden" data-edit-form>
        <input name="name" value="${escapeHtml(item.name)}" aria-label="Item name" />
        <input name="category" value="${escapeHtml(item.category)}" aria-label="Category" />
        <input name="series" value="${escapeHtml(item.series)}" aria-label="Set or series" />
        <select name="action" aria-label="Recommended action">
          ${["Sell", "Hold", "Grade", "Bundle", "Watch"]
            .map((action) => `<option value="${action}" ${action === item.action ? "selected" : ""}>${action}</option>`)
            .join("")}
        </select>
        <textarea name="explanation" aria-label="AI explanation">${escapeHtml(item.explanation)}</textarea>
        <button class="secondary-button approve" type="submit">Save edit</button>
      </form>
      <section class="verified-value">
        <div>
          <span>Verified Market Value(TM)</span>
          <strong>${currency.format(item.value)}</strong>
        </div>
        <div class="verified-grid">
          <span>${item.confidence}% confidence</span>
          <span>Recent sold comps pending</span>
          <button type="button">View All Sales</button>
          <button type="button">Why This Price?</button>
        </div>
      </section>
      <div class="condition-row">
        <span>Condition estimate</span>
        <strong>${escapeHtml(item.condition)}</strong>
      </div>
      <div class="review-actions">
        <button class="secondary-button approve" type="button" data-action="approve" ${actionDisabled}>Approve</button>
        <button class="secondary-button" type="button" data-action="edit" ${actionDisabled}>Edit</button>
        <button class="danger-button" type="button" data-action="reject" ${actionDisabled}>Reject</button>
      </div>
    `;

    card.querySelector("[data-action='approve']").addEventListener("click", (event) => {
      event.currentTarget.disabled = true;
      approveItems([item.id]);
    });
    card.querySelector("[data-action='reject']").addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      await rejectItem(item.id);
    });
    card.querySelector("[data-action='edit']").addEventListener("click", () => {
      card.querySelector("[data-edit-form]").classList.toggle("hidden");
    });
    card.querySelectorAll(".verified-grid button").forEach((button) => {
      button.addEventListener("click", () => {
        showToast("Marketplace sales history is a future integration");
      });
    });
    card.querySelector("[data-edit-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      updateQueueItem(item.id, {
        name: form.get("name").trim() || item.name,
        category: form.get("category").trim() || item.category,
        series: form.get("series").trim() || item.series,
        action: form.get("action"),
        explanation: form.get("explanation").trim() || item.explanation,
        recommendationReason: getRecommendationReason(form.get("action"))
      });
      showToast("Result updated");
    });

    reviewQueue.append(card);
  });
}

function renderInventory() {
  inventoryList.innerHTML = "";
  renderInventorySummary();
  const items =
    state.activeFilter === "All"
      ? state.inventory
      : state.inventory.filter((item) => item.category === state.activeFilter);
  const filteredItems = state.searchQuery
    ? items.filter((item) =>
        [item.name, item.category, item.series, item.action, item.marketplace]
          .join(" ")
          .toLowerCase()
          .includes(state.searchQuery)
      )
    : items;

  if (!filteredItems.length) {
    const title = state.inventory.length ? "No matches found" : "Inventory is empty";
    const copy = state.inventory.length
      ? "Try a different item, set, category, action, or marketplace."
      : "Approved review results will appear here automatically.";
    inventoryList.append(createEmptyState(title, copy, !state.inventory.length));
    return;
  }

  filteredItems.forEach((item) => inventoryList.append(createInventoryRow(item)));
}

function renderInventorySummary() {
  if (!inventorySummary) return;
  const summary = state.lastInventorySummary;
  inventorySummary.classList.toggle("hidden", !summary);
  if (!summary) {
    inventorySummary.innerHTML = "";
    return;
  }
  inventorySummary.innerHTML = `
    <strong>${summary.count} item${summary.count === 1 ? "" : "s"} added to inventory</strong>
    <span>Total estimated value ${currency.format(summary.totalValue)}</span>
    <div>
      ${Object.entries(summary.categories)
        .map(([category, count]) => `<small>${escapeHtml(category)}: ${count}</small>`)
        .join("")}
    </div>
  `;
}

function createInventorySummary(items) {
  return {
    count: items.length,
    totalValue: items.reduce((sum, item) => sum + Number(item.value || 0), 0),
    categories: items.reduce((acc, item) => {
      const category = item.category || "Collectible";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  };
}

function renderDetail() {
  if (!state.selectedItem) return;
  const item = state.selectedItem;
  detailContent.style.setProperty("--art", item.art);
  detailContent.innerHTML = `
    <div class="detail-art"></div>
    <h2 id="detailTitle">${escapeHtml(item.name)}</h2>
    <p class="detail-meta">${escapeHtml(item.category)} / ${escapeHtml(item.series)}</p>
    <div class="market-strip">
      <span>Mock market source</span>
      <strong>${escapeHtml(item.marketplace)}</strong>
    </div>
    <div class="detail-value">
      <div class="value-box">
        <span>Estimated value</span>
        <strong>${currency.format(item.value)}</strong>
      </div>
      <div class="value-box">
        <span>Range</span>
        <strong>${currency.format(item.low)}-${currency.format(item.high)}</strong>
      </div>
    </div>
    <div class="value-row">
      <span class="pill action-${item.action.toLowerCase()}">${escapeHtml(item.action)}</span>
      <strong>${item.confidence}%</strong>
    </div>
    <div class="confidence">
      <span>Confidence score</span>
      <div class="meter" style="--score: ${item.confidence}%"><i></i></div>
    </div>
    <p class="recommendation">${escapeHtml(item.recommendationReason)}</p>
    <p class="ai-note">${escapeHtml(item.explanation)}</p>
  `;
}

function renderProfile() {
  const user = getCurrentUser();
  const profile = state.profile || {};
  const displayName = profile.display_name || user?.email?.split("@")[0] || "Collector";
  profileUsername.value = profile.username || "";
  profileDisplayName.value = displayName;
  profileAvatarUrl.value = profile.avatar_url || "";
  profileBio.value = profile.bio || "";
  profileDisplayLabel.textContent = displayName;
  profileEmailLabel.textContent = user?.email || "Signed in";
  profileCollectionCount.textContent = state.inventory.length;
  profileAvatarPreview.textContent = displayName.slice(0, 1).toUpperCase();
}

async function approveItems(ids) {
  if (state.isApproving) return;
  const approvedItems = state.queue.filter((item) => ids.includes(item.id));
  if (!approvedItems.length) return;

  state.isApproving = true;
  renderReview();
  try {
    state.inventory = await GlitchAdapters.inventoryRepository.saveApprovedItems(
      state.inventory,
      approvedItems
    );
    state.queue = state.queue.filter((item) => !ids.includes(item.id));
    setActiveFilter("All");
    state.lastInventorySummary = createInventorySummary(approvedItems);
    showToast(`${approvedItems.length} added to inventory`);
    if (!state.queue.length && state.page === "review") navigate("inventory");
  } catch (error) {
    console.error(error);
    showToast("Could not add to inventory");
  } finally {
    state.isApproving = false;
    renderAll();
  }
}

async function identifyAndCreateReviewItems() {
  if (GlitchAdapters.auth?.isDevMode?.()) {
    const identified = await GlitchAdapters.recognition.identifyPhotos(state.uploadedPhotos);
    const enriched = await GlitchAdapters.valueEngine.enrichItems(identified);
    return persistReviewItems(enriched);
  }

  const photoRefs = state.uploadedPhotos.map((photo) => photo.storage).filter(Boolean);
  if (photoRefs.length !== state.uploadedPhotos.length) {
    throw new Error("Photos must finish uploading before identification can start.");
  }

  const result = await GlitchAdapters.auth.identifyUploadedPhotos(photoRefs);
  return normalizeSupabaseItems(result.reviewItems || []);
}

async function persistReviewItems(items) {
  if (!GlitchAdapters.auth?.isConfigured() || !state.session) return items;
  const user = getCurrentUser();
  if (!user) return items;
  const scan = await GlitchAdapters.auth.createScan({
    user_id: user.id,
    status: "completed",
    source_bucket: state.uploadedPhotos[0]?.storage?.bucket || "dev-local",
    source_path: state.uploadedPhotos[0]?.storage?.path || null,
    source_url: state.uploadedPhotos[0]?.storage?.url || state.uploadedPhotos[0]?.url || null,
    ai_provider: "mock",
    ai_model: "dev-mock",
    raw_result: { items },
    metadata: { photo_count: state.uploadedPhotos.length, review_item_count: items.length }
  });

  const rows = items.map((item, index) => {
    const photo = state.uploadedPhotos[index % state.uploadedPhotos.length];
    return {
      user_id: user.id,
      scan_id: scan?.id || null,
      name: item.name,
      category: item.category,
      series: item.series,
      estimated_value: item.value,
      low_value: item.low,
      high_value: item.high,
      confidence: item.confidence,
      condition_estimate: item.condition,
      recommended_action: item.action,
      marketplace_source: item.marketplace,
      ai_explanation: item.explanation,
      photo_url: photo?.storage?.url || photo?.url || null,
      photo_path: photo?.storage?.path || null,
      photo_bucket: photo?.storage?.bucket || null,
      status: "pending"
    };
  });

  const inserted = await GlitchAdapters.auth.insertReviewItems(rows);
  return normalizeSupabaseItems(inserted);
}

async function rejectItem(id) {
  await rejectItems([id]);
}

async function rejectItems(ids) {
  try {
    const rejected = state.queue.filter((entry) => ids.includes(entry.id));
    const uuidIds = ids.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    );
    if (uuidIds.length || GlitchAdapters.auth?.isDevMode?.()) {
      await GlitchAdapters.auth.deleteReviewItems(ids);
    }
    state.queue = state.queue.filter((entry) => !ids.includes(entry.id));
    showToast(`${rejected.length} result${rejected.length === 1 ? "" : "s"} rejected`);
  } catch (error) {
    console.error(error);
    showToast("Could not reject results");
  } finally {
    renderAll();
  }
}

function getVisibleReviewItems() {
  return state.reviewFilter === "All"
    ? state.queue
    : state.queue.filter((item) => item.category === state.reviewFilter);
}

function updateQueueItem(id, patch) {
  state.queue = state.queue.map((item) => (item.id === id ? { ...item, ...patch } : item));
  renderAll();
}

function createInventoryRow(item) {
  const row = document.createElement("article");
  row.className = "item-row";
  row.role = "button";
  row.tabIndex = 0;
  row.style.setProperty("--art", item.art);
  row.innerHTML = itemMarkup(item);
  const openDetail = () => {
    state.selectedItem = item;
    state.previousPage = state.page === "detail" ? state.previousPage : state.page;
    renderDetail();
    navigate("detail");
  };
  row.addEventListener("click", openDetail);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail();
    }
  });
  return row;
}

function itemMarkup(item) {
  return `
    <div class="item-topline">
      <div class="item-art"></div>
      <div class="item-main">
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.category)} / ${escapeHtml(item.series)} / ${escapeHtml(item.marketplace)}</p>
      </div>
    </div>
    <div class="value-row">
      <strong>${currency.format(item.value)}</strong>
      <span class="pill action-${item.action.toLowerCase()}">${escapeHtml(item.action)}</span>
    </div>
    <div class="confidence">
      <span>${currency.format(item.low)}-${currency.format(item.high)} value range / ${item.confidence}% confidence</span>
      <div class="meter" style="--score: ${item.confidence}%"><i></i></div>
    </div>
    <p class="ai-note">${escapeHtml(item.explanation)}</p>
  `;
}

function createEmptyState(title, copy, showAction = false) {
  const node = emptyTemplate.content.cloneNode(true);
  node.querySelector("strong").textContent = title;
  node.querySelector("p").textContent = copy;
  if (showAction) {
    const button = document.createElement("button");
    button.className = "primary-button empty-action";
    button.type = "button";
    button.textContent = "Start Scanning";
    button.addEventListener("click", () => navigate("scan"));
    node.querySelector(".empty-state").append(button);
  }
  return node;
}

function renderAll() {
  renderDashboard();
  renderReview();
  renderInventory();
  renderDetail();
  renderProfile();
  supabaseStatus.textContent = GlitchAdapters.auth?.isConfigured()
    ? "Configured"
    : "Missing config.js keys";
  renderStorageStatus();
  renderProductionSafety();
  renderSettingsProfile();
}

function renderSettingsProfile() {
  if (!settingsProfileStatus) return;
  const name = state.profile?.display_name || getCurrentUser()?.email || "Not loaded";
  settingsProfileStatus.textContent = `${name} / ${state.inventory.length} item${state.inventory.length === 1 ? "" : "s"}`;
}

async function verifyStorageHealth() {
  try {
    state.storageHealth = await GlitchAdapters.auth.verifyStorageBuckets();
  } catch (error) {
    console.error(error);
    state.storageHealth = { ok: false, error: cleanError(error.message), buckets: [] };
  }
}

function renderStorageStatus() {
  if (!storageStatus) return;
  if (!state.storageHealth) {
    storageStatus.textContent = "Checking...";
    return;
  }
  const ready = state.storageHealth.buckets?.filter((bucket) => bucket.exists).length || 0;
  if (state.storageHealth.needsServerKey) {
    storageStatus.textContent = "Server verification key needed";
    return;
  }
  storageStatus.textContent = state.storageHealth.ok
    ? "Ready: card-images, uploads, profile-images"
    : `${ready}/3 ready`;
}

function renderProductionSafety() {
  if (!productionSafetyStatus) return;
  const devEnabled = Boolean(window.GLITCH_CONFIG?.devAuthBypass?.enabled);
  const production = window.GLITCH_CONFIG?.appEnvironment === "production";
  productionSafetyStatus.textContent = devEnabled && !production
    ? "DEV mode enabled"
    : "Production-safe auth";
}

function setActiveFilter(filter) {
  state.activeFilter = filter;
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === filter);
  });
}

function setQuickAddOpen(isOpen) {
  quickAddMenu.classList.toggle("hidden", !isOpen);
  quickAddButton.setAttribute("aria-expanded", String(isOpen));
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 240);
  }, 1800);
}

function getCurrentUser() {
  return state.session?.user || null;
}

function normalizeSupabaseItems(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category || "Collectible",
    series: row.series || "Unknown",
    value: Number(row.estimated_value || 0),
    low: Number(row.low_value || row.estimated_value || 0),
    high: Number(row.high_value || row.estimated_value || 0),
    confidence: Number(row.confidence || 0),
    condition: row.condition_estimate || "Unverified",
    action: row.recommended_action || "Watch",
    marketplace: row.marketplace_source || "Mock",
    explanation: row.ai_explanation || "AI explanation pending.",
    recommendationReason: getRecommendationReason(row.recommended_action || "Watch"),
    photoUrl: row.photo_url,
    photoPath: row.photo_path,
    art: imageBackground(row.photo_url)
  }));
}

function imageBackground(url) {
  if (!url) {
    return "linear-gradient(145deg, rgba(255,255,255,.3), transparent 42%), linear-gradient(160deg, #ffca52, #f24b7a 45%, #6b38ff)";
  }
  return `linear-gradient(145deg, rgba(255,255,255,.18), transparent 42%), url("${String(url).replaceAll('"', "%22")}") center / cover`;
}

function cleanError(message = "") {
  try {
    const parsed = JSON.parse(message);
    return parsed.msg || parsed.message || message;
  } catch {
    return message || "Something went wrong.";
  }
}

function getRecommendationReason(action) {
  return {
    Sell: "Demand is strong enough to prioritize liquidity now.",
    Hold: "Value trend looks healthier if the item stays in inventory.",
    Grade: "Potential condition upside is large enough to justify authentication.",
    Bundle: "Best return may come from grouping related lower-value items.",
    Watch: "More confidence is needed before making a listing or grading decision."
  }[action];
}

function scaleMarketValue(base = { value: 30, low: 20, high: 45 }, id = "") {
  const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const multiplier = 0.74 + (seed % 19) / 20;
  const value = Math.round(base.value * multiplier);
  return {
    value,
    low: Math.max(5, Math.round(base.low * multiplier)),
    high: Math.max(value, Math.round(base.high * multiplier))
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
