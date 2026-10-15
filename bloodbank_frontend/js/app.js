
const API_BASE_URL = "http://172.23.232.27:3000";

const bloodData = [
    ["A+", 82],
    ["A-", 31],
    ["B+", 67],
    ["B-", 19],
    ["O+", 104],
    ["O-", 28],
    ["AB+", 45],
    ["AB-", 12]
];

// =========================
// INITIAL PAGE SETUP
// =========================

document.addEventListener("DOMContentLoaded", () => {

    // SIDEBAR
    const aside = document.querySelector(".sidebar");

    if (aside && !aside.innerHTML.trim()) {
        aside.innerHTML = `
            <div class="side-brand">
                <span>🩸</span>
                <b>BloodBank</b>
            </div>

            <div class="user-mini">
                <div class="avatar">A</div>
                <div>
                    <b>Admin User</b>
                    <small>Administrator</small>
                </div>
            </div>

            <nav class="side-nav">
                <a href="dashboard.html">▦ <span>Dashboard</span></a>
                <a href="donors.html">♙ <span>Donors</span></a>
                <a href="recipients.html">♧ <span>Recipients</span></a>
                <a href="inventory.html">▣ <span>Blood Inventory</span></a>
                <a href="requests.html">⌁ <span>Blood Requests</span></a>
                <a href="donations.html">♥ <span>Donations</span></a>
                <a href="reports.html">▤ <span>Reports</span></a>
            </nav>

            <div class="side-bottom">
                <a href="#">⚙ <span>Settings</span></a>
                <a href="index.html">↪ <span>Logout</span></a>
            </div>
        `;
    }

    // ACTIVE SIDEBAR LINK
    const path = location.pathname.split("/").pop();

    document.querySelectorAll(".side-nav a").forEach(a => {
        if (a.getAttribute("href") === path) {
            a.classList.add("active");
        }
    });

    // DASHBOARD BLOOD GRID - DEMO DATA FOR NOW

const bg = document.getElementById("bloodGrid");

if (bg) {
    bg.innerHTML = `<p>Loading blood inventory...</p>`;

    fetch(`${API_BASE_URL}/api/inventory/summary`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch inventory");
            }
            return response.json();
        })
        .then(data => {
            const groups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

            bg.innerHTML = groups.map(group => {
                const record = data.find(item => item.blood_grp === group);
                const quantity = Number(record?.available_quantity || 0);
                const percentage = Math.min(quantity, 100);

                return `
                    <div class="blood-item">
                        <b>${group}</b>
                        <strong>${quantity} ml</strong>
                        <span>${quantity < 25 ? "Low stock" : "Available"}</span>
                        <div class="progress">
                            <i style="width:${percentage}%"></i>
                        </div>
                    </div>
                `;
            }).join("");
        })
        .catch(error => {
            console.error("Dashboard inventory error:", error);
            bg.innerHTML = `<p>Could not load blood inventory.</p>`;
        });
}


    // INVENTORY CARDS - DEMO DATA FOR NOW
    const inv = document.getElementById("inventoryCards");

    if (inv) {
        inv.innerHTML = bloodData.map(([g, n]) => `
            <div class="inv">
                <b>${g}</b>
                <strong>${n}</strong>
                <small>units</small>
            </div>
        `).join("");
    }

    // RECENT REQUESTS - DEMO DATA FOR NOW
    const rr = document.getElementById("recentRequests");

    if (rr) {
        rr.innerHTML = [
            ["Aarav Shah", "O+", "2 units", "Pending"],
            ["Riya Deshmukh", "A-", "1 unit", "Approved"],
            ["Kabir Singh", "B+", "3 units", "Pending"],
            ["Meera Nair", "O-", "2 units", "Approved"]
        ].map(x => `
            <div class="request">
                <div>
                    <b>${x[0]}</b>
                    <small>${x[1]} · ${x[2]}</small>
                </div>
                <span class="status ${x[3].toLowerCase()}">
                    ${x[3]}
                </span>
            </div>
        `).join("");
    }

    // SHOW / HIDE PASSWORD
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener("click", function () {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                togglePassword.textContent = "Hide";
            } else {
                passwordInput.type = "password";
                togglePassword.textContent = "Show";
            }
        });
    }

    // LOAD REAL DONORS ON THE DONOR PAGE
    if (document.getElementById("donorTableBody")) {
        loadDonors();
    }

    if (document.getElementById("recipientTableBody")) {
    loadRecipients();
}

if (document.getElementById("inventoryTableBody")) {
    loadInventory();
}

});

// =========================
// TOAST MESSAGE
// =========================

function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);

    setTimeout(() => t.remove(), 3000);
}

// =========================
// OLD DEMO FORM SUPPORT
// =========================

function fakeSubmit(e, msg) {
    e.preventDefault();
    toast(msg);
}

// =========================
// SAFE HTML DISPLAY
// =========================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// =========================
// LOAD DONORS FROM MYSQL
// =========================

async function loadDonors() {
    const tbody = document.getElementById("donorTableBody");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr><td colspan="7">Loading donors...</td></tr>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/api/donors`);

        if (!response.ok) {
            throw new Error("Unable to retrieve donors from the server.");
        }

        const donors = await response.json();

        if (!Array.isArray(donors)) {
            throw new Error("Unexpected response from the server.");
        }

        if (donors.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7">No donors found. Add your first donor!</td></tr>
            `;
            return;
        }

        tbody.innerHTML = donors.map(donor => `
            <tr>
                <td>D${String(donor.donor_id).padStart(3, "0")}</td>
                <td><b>${escapeHTML(donor.name)}</b></td>
                <td>
                    <span class="blood-tag">
                        ${escapeHTML(donor.blood_grp)}
                    </span>
                </td>
                <td>${escapeHTML(donor.contact || "—")}</td>
                <td>—</td>
                <td>
                    <span class="status">
                        Not specified
                    </span>
                </td>
                <td>—</td>
            </tr>
        `).join("");

        filterTable();

    } catch (error) {
        console.error("Load donors error:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    Unable to load donors. Check that the backend is running
                    and the API address is correct.
                </td>
            </tr>
        `;
    }
}

// =========================
// ADD DONOR MODAL
// =========================

function openModal(title) {
    
    if (title.toLowerCase().includes("recipient")) {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";

        backdrop.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${escapeHTML(title)}</h2>
                    <button type="button" class="modal-close">&times;</button>
                </div>

                <form id="addRecipientForm">
                    <div class="form-group">
                        <label>Patient Name</label>
                        <input name="recipient" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Age</label>
                            <input name="age" type="number" min="0" max="120" required>
                        </div>

                        <div class="form-group">
                            <label>Gender</label>
                            <select name="gender" required>
                                <option value="">Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Blood Group</label>
                        <select name="blood_grp" required>
                            <option value="">Select blood group</option>
                            <option>A+</option>
                            <option>A-</option>
                            <option>B+</option>
                            <option>B-</option>
                            <option>AB+</option>
                            <option>AB-</option>
                            <option>O+</option>
                            <option>O-</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Contact</label>
                        <input name="contact" type="tel" required>
                    </div>

                    <div class="form-group">
                        <label>Address</label>
                        <textarea name="address" required></textarea>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn secondary cancel-recipient">
                            Cancel
                        </button>
                        <button type="submit" class="btn primary">
                            Save Recipient
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(backdrop);

        backdrop.querySelector(".modal-close").onclick = () => backdrop.remove();
        backdrop.querySelector(".cancel-recipient").onclick = () => backdrop.remove();

        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) backdrop.remove();
        });

        backdrop.querySelector("#addRecipientForm").addEventListener("submit", event => {
            event.preventDefault();
            saveRecipient(event.currentTarget, backdrop);
        });

        return;
    }

    // Keep other pages' forms in demo mode for now.
    if (!title.toLowerCase().includes("donor")) {
        const b = document.createElement("div");
        b.className = "modal-backdrop";

        b.innerHTML = `
            <div class="modal">
                <button class="close" type="button"
                    onclick="this.closest('.modal-backdrop').remove()">
                    ×
                </button>

                <h2>${escapeHTML(title)}</h2>
                <p class="muted">
                    This form is not connected to the database yet.
                </p>

                <label>Name / Patient</label>
                <input placeholder="Enter name">

                <label>Blood Group</label>
                <select>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>O+</option>
                    <option>O-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                </select>

                <label>Units</label>
                <input type="number" min="1" placeholder="Number of units">

                <br>

                <button class="btn primary full" type="button"
                    onclick="this.closest('.modal-backdrop').remove();toast('This feature is not connected yet.')">
                    Save
                </button>
            </div>
        `;

        document.body.appendChild(b);
        return;
    }

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    backdrop.innerHTML = `
        <div class="modal">
            <button class="close" type="button"
                aria-label="Close"
                onclick="this.closest('.modal-backdrop').remove()">
                ×
            </button>

            <h2>${escapeHTML(title)}</h2>

            <form id="addDonorForm">
                <label>Full Name *</label>
                <input name="name" required maxlength="100"
                    placeholder="Enter full name">

                <label>Age</label>
                <input name="age" type="number" min="18" max="100"
                    placeholder="Enter age">

                <label>Address</label>
                <input name="address" maxlength="255"
                    placeholder="Enter address">

                <label>Gender</label>
                <select name="gender">
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>

                <label>Blood Group *</label>
                <select name="blood_grp" required>
                    <option value="">Select blood group</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>O+</option>
                    <option>O-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                </select>

                <label>Phone Number</label>
                <input name="contact" type="tel" maxlength="15"
                    placeholder="Enter phone number">

                <button class="btn primary full" type="submit">
                    Save Donor
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(backdrop);

    const form = backdrop.querySelector("#addDonorForm");

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const data = new FormData(form);

        const donor = {
            name: data.get("name").trim(),
            age: data.get("age") || null,
            address: data.get("address").trim() || null,
            gender: data.get("gender") || null,
            blood_grp: data.get("blood_grp"),
            contact: data.get("contact").trim() || null
        };

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Saving...";

        try {
            const response = await fetch(`${API_BASE_URL}/api/donors`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(donor)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to save donor.");
            }

            // Reload from MySQL after the insert succeeds.
            await loadDonors();

            backdrop.remove();

            toast(
                `Donor saved successfully! ID: D${String(result.donor_id).padStart(3, "0")}`
            );

        } catch (error) {
            console.error("Add donor error:", error);

            toast(error.message || "Unable to connect to the backend.");

            button.disabled = false;
            button.textContent = "Save Donor";
        }
    });
}

// =========================
// TABLE SEARCH + BLOOD FILTER
// =========================

function filterTable() {
    const search = (
        document.getElementById("tableSearch")?.value || ""
    ).toLowerCase();

    const bloodGroup = (
        document.getElementById("donorBloodFilter")?.value || ""
    ).toLowerCase();

    document.querySelectorAll("#dataTable tbody tr").forEach(row => {
        const rowText = row.innerText.toLowerCase();
        const rowBloodGroup = row.cells[2]?.innerText.trim().toLowerCase() || "";

        // Keep loading, error and empty-state messages visible.
        if (row.cells.length === 1) {
            row.style.display = "";
            return;
        }

        const matchesSearch = rowText.includes(search);
        const matchesBloodGroup =
            !bloodGroup || rowBloodGroup === bloodGroup;

        row.style.display =
            matchesSearch && matchesBloodGroup ? "" : "none";
    });
}



async function loadRecipients() {
    const tbody = document.getElementById("recipientTableBody");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7">Loading recipients...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/recipients`);

        if (!response.ok) {
            throw new Error("Could not load recipients");
        }

        const recipients = await response.json();

        if (!recipients.length) {
            tbody.innerHTML = '<tr><td colspan="7">No recipients found.</td></tr>';
            return;
        }

        tbody.innerHTML = recipients.map(r => `
            <tr>
                <td>R${String(r.recipient_id).padStart(3, "0")}</td>
                <td><b>${escapeHTML(r.recipient)}</b></td>
                <td><span class="blood-tag">${escapeHTML(r.blood_grp || "—")}</span></td>
                <td>${escapeHTML(r.contact || "—")}</td>
                <td>${escapeHTML(r.address || "—")}</td>
                <td>${escapeHTML(r.age ?? "—")}</td>
                <td>${escapeHTML(r.gender || "—")}</td>
            </tr>
        `).join("");

        filterTable();
    } catch (error) {
        console.error("Load recipients error:", error);
        tbody.innerHTML = '<tr><td colspan="7">Could not load recipients. Check the backend.</td></tr>';
    }
}

async function saveRecipient(form, backdrop) {
    const data = new FormData(form);

    const recipient = {
        recipient: data.get("recipient").trim(),
        age: data.get("age") || null,
        gender: data.get("gender") || null,
        contact: data.get("contact").trim(),
        address: data.get("address").trim(),
        blood_grp: data.get("blood_grp")
    };

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE_URL}/api/recipients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(recipient)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not save recipient");
        }

        backdrop.remove();
        toast("Recipient saved successfully!");
        await loadRecipients();
    } catch (error) {
        console.error("Save recipient error:", error);
        toast(error.message || "Could not save recipient");
        button.disabled = false;
        button.textContent = "Save Recipient";
    }
}


async function loadInventory() {
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/inventory/summary`);

        if (!response.ok) {
            throw new Error("Could not load inventory");
        }

        const data = await response.json();
        const groups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

        tbody.innerHTML = groups.map(group => {
            const record = data.find(item => item.blood_grp === group);
            const available = Number(record?.available_quantity || 0);
            const reserved = Number(record?.reserved_quantity || 0);
            const percentage = Math.min(100, Math.round(available));

            return `
                <tr>
                    <td><b>${escapeHTML(group)}</b></td>
                    <td>${available}</td>
                    <td>${reserved}</td>
                    <td>—</td>
                    <td>
                        <div class="progress">
                            <i style="width:${percentage}%"></i>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Inventory loading error:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5">Could not load inventory. Check the backend.</td>
            </tr>
        `;
    }
}
