const slotsTableBody = document.getElementById('slots-table-body');
const reservationForm = document.getElementById('reservation-form');
const reserverNameInput = document.getElementById('reserver-name');
const talkTitleInput = document.getElementById('talk-title');
const reservationHint = document.getElementById('reservation-hint');

let currentSlots = [];

// =====================================================
// SUPABASE CONFIGURATION
// =====================================================

const supabaseConfig = {
  url: 'https://iohmskkygryodqxwipas.supabase.co',
  anonKey: 'sb_publishable_UeBC4bL7znRATbDREs1ucw_mLKpw1-0',
  tableName: 'brown_bag_slots',
};

const supabaseReady = Boolean(
  window.supabase &&
    supabaseConfig.url &&
    supabaseConfig.anonKey
);

const client = supabaseReady
  ? window.supabase.createClient(
      supabaseConfig.url,
      supabaseConfig.anonKey
    )
  : null;


// =====================================================
// HELPERS
// =====================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}


function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}


// =====================================================
// RENDER CALENDAR
// =====================================================

function renderSlots(rows) {
  currentSlots = Array.isArray(rows) ? rows : [];

  if (!currentSlots.length) {
    slotsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="loading">
          No Brown Bag dates have been loaded yet.
        </td>
      </tr>
    `;
    return;
  }

  const typedName = reserverNameInput?.value || '';
  const currentName = normalizeName(typedName);
  const hasNameTyped = currentName.length > 0;

  slotsTableBody.innerHTML = currentSlots
    .map((row) => {

      /*
       * IMPORTANT:
       * reserved_by is the ONLY field that determines
       * whether the slot is reserved.
       *
       * speaker = "TBD" does NOT mean reserved.
       */

      const ownerName = row.reserved_by || null;

      const isReserved = Boolean(ownerName);

      const isOwnedByCurrentUser =
        isReserved &&
        hasNameTyped &&
        normalizeName(ownerName) === currentName;

      const isBookedBySomeoneElse =
        isReserved &&
        !isOwnedByCurrentUser;

      const displaySpeaker = isReserved
        ? ownerName
        : 'TBD';

      const displayTitle =
        row.title?.trim() || 'TBD';

      return `
        <tr>

          <td>
            ${escapeHtml(formatDate(row.slot_date))}
          </td>

          <td>
            <strong>
              ${escapeHtml(displayTitle)}
            </strong>

            ${
              row.notes
                ? `
                  <div class="slot-note">
                    ${escapeHtml(row.notes)}
                  </div>
                `
                : ''
            }
          </td>

          <td>
            ${escapeHtml(displaySpeaker)}
          </td>

          <td>
            ${
              isReserved
                ? `
                  <span class="badge reserved">
                    Reserved
                  </span>
                `
                : `
                  <span class="badge available">
                    Available
                  </span>
                `
            }
          </td>

          <td>

            ${
              isOwnedByCurrentUser
                ? `
                  <div class="slot-actions">

                    <button
                      type="button"
                      class="button slot-button"
                      data-slot-id="${row.id}"
                    >
                      Update
                    </button>

                    <button
                      type="button"
                      class="button secondary slot-button"
                      data-remove-slot-id="${row.id}"
                    >
                      Remove
                    </button>

                  </div>
                `

                : isBookedBySomeoneElse

                  ? `
                    <button
                      type="button"
                      class="button slot-button"
                      disabled
                    >
                      Unavailable
                    </button>
                  `

                  : `
                    <button
                      type="button"
                      class="button slot-button"
                      data-slot-id="${row.id}"
                    >
                      Reserve
                    </button>
                  `
            }

          </td>

        </tr>
      `;
    })
    .join('');
}


// =====================================================
// LOAD CALENDAR FROM SUPABASE
// =====================================================

async function loadSlots() {

  if (!client) {
    slotsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="loading">
          Supabase is not connected.
        </td>
      </tr>
    `;

    return;
  }

  try {

    const { data, error } = await client
      .from(supabaseConfig.tableName)
      .select(`
        id,
        slot_date,
        title,
        speaker,
        reserved_by,
        display_order
      `)
      .order('slot_date', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    renderSlots(data || []);

  } catch (error) {

    console.error('Error loading Brown Bag calendar:', error);

    slotsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="loading">
          Could not load the calendar.
        </td>
      </tr>
    `;
  }
}


// =====================================================
// REMOVE ONE RESERVATION
// =====================================================

async function removeReservation(slotId) {

  if (!client) {
    return false;
  }

  const reserverName =
    reserverNameInput.value.trim();

  if (!reserverName) {
    reservationHint.textContent =
      'Enter your name before removing a reservation.';

    return false;
  }

  reservationHint.textContent =
    'Removing your reservation...';

  try {

    // Check slot first
    const {
      data: targetSlot,
      error: targetError
    } = await client
      .from(supabaseConfig.tableName)
      .select('id, reserved_by')
      .eq('id', slotId)
      .single();

    if (targetError) {
      throw targetError;
    }

    if (!targetSlot.reserved_by) {

      reservationHint.textContent =
        'This date is already available.';

      await loadSlots();

      return true;
    }

    if (
      normalizeName(targetSlot.reserved_by) !==
      normalizeName(reserverName)
    ) {

      reservationHint.textContent =
        'You can only remove your own reservation.';

      return false;
    }


    // Remove through Supabase RPC
    const { error } = await client.rpc(
      'remove_brown_bag_slot',
      {
        slot_id: slotId,
        reserver_name: reserverName,
      }
    );

    if (error) {
      throw error;
    }


    reservationHint.textContent =
      `Reservation removed for ${reserverName}.`;

    await loadSlots();

    return true;

  } catch (error) {

    console.error(
      'Error removing reservation:',
      error
    );

    reservationHint.textContent =
      'The reservation could not be removed.';

    return false;
  }
}


// =====================================================
// RESERVE OR UPDATE A SLOT
// =====================================================

async function reserveSlot(slotId) {

  if (!client) {
    return;
  }

  const reserverName =
    reserverNameInput.value.trim();

  const talkTitle =
    talkTitleInput?.value.trim() || null;


  if (!reserverName) {

    reservationHint.textContent =
      'Enter your name before reserving a date.';

    reserverNameInput.focus();

    return;
  }


  reservationHint.textContent =
    'Updating your reservation...';


  try {

    // -------------------------------------------------
    // 1. Check selected slot
    // -------------------------------------------------

    const {
      data: targetSlot,
      error: targetError
    } = await client
      .from(supabaseConfig.tableName)
      .select(`
        id,
        reserved_by,
        slot_date,
        title
      `)
      .eq('id', slotId)
      .single();


    if (targetError) {
      throw targetError;
    }


    const currentOwner =
      targetSlot.reserved_by || null;


    // Someone else already has it
    if (
      currentOwner &&
      normalizeName(currentOwner) !==
        normalizeName(reserverName)
    ) {

      reservationHint.textContent =
        'That date is already reserved by someone else.';

      await loadSlots();

      return;
    }


    // -------------------------------------------------
    // 2. Find another reservation under this name
    // -------------------------------------------------

    const {
      data: existingReservations,
      error: existingError
    } = await client
      .from(supabaseConfig.tableName)
      .select(`
        id,
        reserved_by
      `);


    if (existingError) {
      throw existingError;
    }


    const previousReservations =
      (existingReservations || []).filter(
        (entry) =>
          Number(entry.id) !== Number(slotId) &&
          entry.reserved_by &&
          normalizeName(entry.reserved_by) ===
            normalizeName(reserverName)
      );


    // -------------------------------------------------
    // 3. Remove previous reservation(s)
    // -------------------------------------------------

    for (const oldReservation of previousReservations) {

      const { error: removeError } =
        await client.rpc(
          'remove_brown_bag_slot',
          {
            slot_id: oldReservation.id,
            reserver_name: reserverName,
          }
        );


      if (removeError) {
        throw removeError;
      }
    }


    // -------------------------------------------------
    // 4. Reserve selected slot
    // -------------------------------------------------

    const { error } = await client.rpc(
      'reserve_brown_bag_slot',
      {
        slot_id: slotId,
        reserver_name: reserverName,
        talk_title: talkTitle,
      }
    );


    if (error) {
      throw error;
    }


    // -------------------------------------------------
    // 5. Update interface
    // -------------------------------------------------

    if (talkTitleInput) {
      talkTitleInput.value = '';
    }


    reservationHint.textContent =
      previousReservations.length > 0
        ? `Reservation moved successfully for ${reserverName}.`
        : `Reservation confirmed for ${reserverName}.`;


    await loadSlots();

  } catch (error) {

    console.error(
      'Error reserving Brown Bag:',
      error
    );

    reservationHint.textContent =
      'That date is no longer available or the reservation could not be updated.';

    await loadSlots();
  }
}


// =====================================================
// CALENDAR BUTTON EVENTS
// =====================================================

slotsTableBody.addEventListener(
  'click',
  async (event) => {

    // -----------------------------------------------
    // REMOVE
    // -----------------------------------------------

    const removeButton =
      event.target.closest(
        '[data-remove-slot-id]'
      );


    if (removeButton) {

      const slotId =
        Number(
          removeButton.dataset.removeSlotId
        );


      if (Number.isNaN(slotId)) {
        return;
      }


      removeButton.disabled = true;

      await removeReservation(slotId);

      return;
    }


    // -----------------------------------------------
    // RESERVE / UPDATE
    // -----------------------------------------------

    const reserveButton =
      event.target.closest(
        '[data-slot-id]'
      );


    if (!reserveButton) {
      return;
    }


    if (reserveButton.disabled) {
      return;
    }


    const slotId =
      Number(
        reserveButton.dataset.slotId
      );


    if (Number.isNaN(slotId)) {
      return;
    }


    reserveButton.disabled = true;

    await reserveSlot(slotId);
  }
);


// =====================================================
// FORM
// =====================================================

reservationForm?.addEventListener(
  'submit',
  (event) => {
    event.preventDefault();
  }
);


// =====================================================
// UPDATE BUTTONS WHEN USER TYPES THEIR NAME
// =====================================================

reserverNameInput?.addEventListener(
  'input',
  () => {

    renderSlots(currentSlots);

    if (
      reserverNameInput.value.trim()
    ) {

      reservationHint.textContent =
        'Choose an available date below. If you already have a reservation, you can update or remove it.';
    }
  }
);


// =====================================================
// INITIAL LOAD
// =====================================================

loadSlots();