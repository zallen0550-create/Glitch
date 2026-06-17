(function () {
  const SESSION_KEY = "glitch.supabase.session";
  const DEV_PROFILE_KEY = "glitch.dev.profile";
  const DEV_INVENTORY_KEY = "glitch.dev.inventory";
  const DEV_REVIEW_KEY = "glitch.dev.review";
  const DEV_SCAN_KEY = "glitch.dev.scans";
  const config = window.GLITCH_CONFIG || {};

  function isConfigured() {
    return Boolean(
      config.supabaseUrl &&
        config.supabaseAnonKey &&
        !config.supabaseUrl.includes("YOUR_PROJECT_REF") &&
        !config.supabaseAnonKey.includes("YOUR_SUPABASE")
    );
  }

  function isDevAuthEnabled() {
    return Boolean(config.devAuthBypass?.enabled && config.appEnvironment !== "production");
  }

  function isDevSession(session = getStoredSession()) {
    return Boolean(session?.is_dev_session && isDevAuthEnabled());
  }

  function readLocalCollection(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function writeLocalCollection(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows));
    return rows;
  }

  function createDevSession() {
    const dev = config.devAuthBypass || {};
    return {
      access_token: "dev-local-session",
      token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      is_dev_session: true,
      user: {
        id: dev.userId || "00000000-0000-4000-8000-000000000001",
        email: dev.email || "dev@glitch.local",
        user_metadata: {
          display_name: dev.displayName || "Zach"
        }
      }
    };
  }

  function getApiBaseUrl() {
    if (config.apiBaseUrl) return config.apiBaseUrl.replace(/\/$/, "");
    if (window.location?.origin && window.location.origin !== "null") return window.location.origin;
    return "http://127.0.0.1:4176";
  }

  function getStoredSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setStoredSession(session) {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async function request(path, options = {}) {
    if (!isConfigured()) {
      throw new Error("Supabase is not configured. Update config.js with your project URL and anon key.");
    }

    const session = getStoredSession();
    const headers = {
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(`${config.supabaseUrl}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Supabase request failed: ${response.status}`);
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function signUp(email, password, metadata) {
    if (isDevAuthEnabled()) {
      const session = createDevSession();
      session.user.email = email || session.user.email;
      session.user.user_metadata.display_name = metadata?.display_name || session.user.user_metadata.display_name;
      setStoredSession(session);
      return session;
    }

    const data = await request("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        data: metadata
      })
    });
    if (data?.access_token) setStoredSession(data);
    return data;
  }

  async function signIn(email, password) {
    if (isDevAuthEnabled()) {
      const dev = config.devAuthBypass || {};
      const validEmail = !dev.email || email === dev.email;
      const validPassword = !dev.password || password === dev.password;
      if (!validEmail || !validPassword) {
        throw new Error("Use the local development account: dev@glitch.local / glitch-dev");
      }
      const session = createDevSession();
      setStoredSession(session);
      return session;
    }

    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setStoredSession(data);
    return data;
  }

  async function resetPassword(email) {
    if (isDevAuthEnabled()) return { dev: true, email };

    return request("/auth/v1/recover", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  async function signOut() {
    const session = getStoredSession();
    if (isDevSession(session)) {
      setStoredSession(null);
      return;
    }

    if (session?.access_token && isConfigured()) {
      await request("/auth/v1/logout", { method: "POST" }).catch(() => null);
    }
    setStoredSession(null);
  }

  async function getSession() {
    const session = getStoredSession();
    if (session?.is_dev_session && !isDevAuthEnabled()) {
      setStoredSession(null);
      return null;
    }
    if (!session?.access_token) return null;
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      setStoredSession(null);
      return null;
    }
    return session;
  }

  async function getProfile(userId) {
    if (isDevSession()) {
      const storedProfile = JSON.parse(localStorage.getItem(DEV_PROFILE_KEY) || "null");
      return (
        storedProfile || {
          id: userId,
          username: "zach",
          display_name: config.devAuthBypass?.displayName || "Zach",
          avatar_url: "",
          bio: "",
          collection_count: readLocalCollection(DEV_INVENTORY_KEY).length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );
    }

    const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, {
      headers: { Accept: "application/json" }
    });
    return rows?.[0] || null;
  }

  async function upsertProfile(profile) {
    if (isDevSession()) {
      const nextProfile = {
        ...profile,
        updated_at: new Date().toISOString(),
        created_at: profile.created_at || new Date().toISOString()
      };
      localStorage.setItem(DEV_PROFILE_KEY, JSON.stringify(nextProfile));
      return nextProfile;
    }

    const rows = await request("/rest/v1/profiles?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(profile)
    });
    return rows?.[0] || null;
  }

  async function listInventory(userId) {
    if (isDevSession()) {
      return readLocalCollection(DEV_INVENTORY_KEY).filter((item) => item.user_id === userId);
    }

    return request(
      `/rest/v1/inventory_items?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`
    );
  }

  async function listReviewQueue(userId) {
    if (isDevSession()) {
      return readLocalCollection(DEV_REVIEW_KEY).filter((item) => item.user_id === userId);
    }

    return request(`/rest/v1/review_items?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`);
  }

  async function createScan(scan) {
    if (isDevSession()) {
      const row = {
        id: crypto.randomUUID(),
        status: scan.status || "completed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        raw_result: {},
        metadata: {},
        ...scan
      };
      writeLocalCollection(DEV_SCAN_KEY, [...readLocalCollection(DEV_SCAN_KEY), row]);
      return row;
    }

    const rows = await request("/rest/v1/scans", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(scan)
    });
    return rows?.[0] || null;
  }

  async function identifyUploadedPhotos(photos) {
    const session = getStoredSession();
    if (isDevSession(session)) {
      throw new Error("DEV identification is handled locally by the mock recognition adapter.");
    }

    console.log(`[Glitch identify] Calling /api/identify with ${photos.length} photo(s).`);
    const response = await fetch(`${getApiBaseUrl()}/api/identify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ photos })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "AI identification failed");
    }
    return body;
  }

  async function verifyStorageBuckets() {
    if (isDevSession()) {
      return {
        ok: true,
        buckets: ["card-images", "uploads", "profile-images"].map((bucket) => ({
          bucket,
          exists: true,
          status: "dev-local"
        }))
      };
    }

    const response = await fetch(`${getApiBaseUrl()}/api/storage-health`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Storage bucket verification failed");
    }
    return body;
  }

  async function insertReviewItems(items) {
    if (isDevSession()) {
      const rows = items.map((item) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item
      }));
      writeLocalCollection(DEV_REVIEW_KEY, [...readLocalCollection(DEV_REVIEW_KEY), ...rows]);
      return rows;
    }

    return request("/rest/v1/review_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(items)
    });
  }

  async function insertInventoryItems(items) {
    if (isDevSession()) {
      const rows = items.map((item) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item
      }));
      writeLocalCollection(DEV_INVENTORY_KEY, [...readLocalCollection(DEV_INVENTORY_KEY), ...rows]);
      return rows;
    }

    return request("/rest/v1/inventory_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(items)
    });
  }

  async function deleteReviewItems(ids) {
    if (!ids.length) return null;
    if (isDevSession()) {
      writeLocalCollection(
        DEV_REVIEW_KEY,
        readLocalCollection(DEV_REVIEW_KEY).filter((item) => !ids.includes(item.id))
      );
      return null;
    }

    const filter = ids.map((id) => `"${id}"`).join(",");
    return request(`/rest/v1/review_items?id=in.(${filter})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  }

  async function uploadItemPhoto(userId, file) {
    if (isDevSession()) {
      return {
        path: `dev/${userId}/${file.name}`,
        bucket: "dev-local",
        url: URL.createObjectURL(file)
      };
    }

    const bucket = config.buckets?.cardImages || config.storageBucket || "card-images";
    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `${userId}/${crypto.randomUUID()}.${extension}`;
    const session = getStoredSession();
    const response = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${bucket}/${fileName}`,
      {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": file.type || "application/octet-stream"
        },
        body: file
      }
    );
    if (!response.ok) throw new Error(await response.text());
    return {
      path: fileName,
      bucket,
      url: `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`
    };
  }

  window.GlitchSupabaseAdapter = {
    isConfigured,
    isDevMode: () => isDevSession(),
    signUp,
    signIn,
    resetPassword,
    signOut,
    getSession,
    getProfile,
    upsertProfile,
    listInventory,
    listReviewQueue,
    createScan,
    identifyUploadedPhotos,
    verifyStorageBuckets,
    insertReviewItems,
    insertInventoryItems,
    deleteReviewItems,
    uploadItemPhoto
  };
})();
