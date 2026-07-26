let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        filterProducts(e.target.value);
    });
});

// Function ya kuvuta data kutoka kwenye API Server
async function fetchProducts() {
    const grid = document.getElementById('productsGrid');

    try {
        const response = await fetch('/api/products');
        const result = await response.json();

        if (result.success) {
            allProducts = result.data;
            renderProducts(allProducts);
        } else {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-red-500">Kosa wakati wa kupata taarifa.</div>`;
        }
    } catch (error) {
        console.error('Error:', error);
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-red-500">Imeshindwa kuunganishwa na server.</div>`;
    }
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    const countSpan = document.getElementById('productCount');

    if (countSpan) countSpan.textContent = products.length;

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <i class="fa-solid fa-box-open text-4xl text-gray-400 mb-2"></i>
                <p class="text-gray-500 font-medium">Hakuna bidhaa iliyosajiliwa kwa sasa.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';

    products.forEach(p => {
        const category = p.category || p.sector || 'Kilimo';
        let categoryBadgeClass = 'bg-emerald-100 text-emerald-800';
        let categoryIcon = '🌱';

        if (category === 'Uvuvi') {
            categoryBadgeClass = 'bg-sky-100 text-sky-800';
            categoryIcon = '🐟';
        } else if (category === 'Mifugo') {
            categoryBadgeClass = 'bg-amber-100 text-amber-800';
            categoryIcon = '🐄';
        }

        // Tarehe kutoka Firebase
        let formattedDate = '';
        if (p.createdAt) {
            let dateObj;
            if (p.createdAt.toDate && typeof p.createdAt.toDate === 'function') {
                dateObj = p.createdAt.toDate();
            } else {
                dateObj = new Date(p.createdAt);
            }

            if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate();
                const month = dateObj.getMonth() + 1;
                const year = dateObj.getFullYear();
                formattedDate = `${day}/${month}/${year}`;
            }
        }

        const qty = Number(p.quantityKg || p.quantity || 0);
        const price = Number(p.pricePerKg || p.pricePerUnit || p.price || 0);
        const totalPrice = qty * price;

        // CARD HTML - Hapa weight za hela zimerudishwa kawaida kama picha yako ya asili
        const cardHTML = `
            <div class="product-card bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" data-category="${category}">
                <div>
                    <!-- Header: Badge & Date -->
                    <div class="flex justify-between items-center mb-4">
                        <span class="${categoryBadgeClass} text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                            <span>${categoryIcon}</span> ${category}
                        </span>
                        <span class="text-xs text-slate-400 flex items-center gap-1">
                            🕒 ${formattedDate}
                        </span>
                    </div>

                    <!-- Title -->
                    <h3 class="text-xl font-bold text-slate-800 mb-4">${p.item || p.name || 'Bidhaa'}</h3>
                   
                    <!-- Values: Zimerudishwa kwenye font-semibold na rangi za asili -->
                    <div class="space-y-2 text-sm text-slate-500 mb-6">
                        <div class="flex justify-between items-center">
                            <span>Kiwango Kinachopatikana:</span>
                            <span class="text-slate-700 font-semibold">${qty.toLocaleString()} Kg</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span>Bei kwa Kilo:</span>
                            <span class="text-emerald-700 font-semibold">TZS ${price.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between items-center pt-1">
                            <span>Jumla ya Thamani:</span>
                            <span class="text-slate-800 font-bold">TZS ${totalPrice.toLocaleString()}</span>
                        </div>
                    </div>

                    <!-- Location Box -->
                     <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-6">
                       <p class="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">ENEO / MAHALI ZAO LILIPO:</p>
                        <p class="text-xs text-slate-600 flex items-center gap-1.5">
                      <i class="fa-solid fa-location-dot text-red-500 text-sm"></i> ${p.location || 'Haikuwekwa'}
                       </p>
                      </div>
                </div>

<div class="pt-2 border-t border-slate-100 flex flex-col gap-2">
    <div class="flex justify-between items-center">
        <div>
            <p class="text-[10px] text-slate-400 uppercase font-medium">Namba ya Simu</p>
            <p class="text-xs font-bold text-slate-700 font-mono">${p.phoneNumber || p.phone || 'Haikuwekwa'}</p>
        </div>
    </div>

<div class="flex items-center gap-2 mt-1">
    <a href="tel:${p.phoneNumber || p.phone || ''}"
       class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition text-center">
        <i class="fa-solid fa-phone text-xs"></i> Piga Simu
    </a>

    <!-- Hii ndiyo button mpya iliyobadilika -->
  <button onclick="openOrderModal(this)"
    data-crop="${p.cropName || p.cropName || p.productName || p.name || 'Zao'}"
    data-price="${p.price || p.pricePerUnit || p.cropPrice || 0}"
    data-phone="${p.phoneNumber || p.phone || ''}"
    class="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1">
    <i class="fa-solid fa-cart-shopping text-xs"></i> Weka Order
</button>
</div>
</div>
`;

        grid.innerHTML += cardHTML;
    });
}
// 1. Kufungua Modal wakati button imebonyezwa
function openOrderModal(btn) {
    const cropName = btn.getAttribute('data-crop') || 'Zao';
    const defaultPrice = btn.getAttribute('data-price') || '0';
    const sellerPhone = btn.getAttribute('data-phone') || 'Hakuna Namba';

    // Jaza data za msingi kwenye modal
    document.getElementById('modalCropName').innerText = cropName;
    document.getElementById('modalSellerPhone').innerText = sellerPhone;
    document.getElementById('orderOfferedPrice').value = defaultPrice;

    // Reset kiasi na jumla
    document.getElementById('orderQuantity').value = '';
    document.getElementById('modalTotalPrice').innerText = 'TZS 0';

    // Onyesha Modal
    document.getElementById('orderModal').classList.remove('hidden');
}

// 2. Kufunga Modal
function closeOrderModal() {
    document.getElementById('orderModal').classList.add('hidden');
}

// 3. Kuhesabu Jumla Kiotomatiki pindi mtumiaji anapoandika
function calculateModalTotal() {
    const qty = Number(document.getElementById('orderQuantity').value) || 0;
    const price = Number(document.getElementById('orderOfferedPrice').value) || 0;
    const total = qty * price;
    document.getElementById('modalTotalPrice').innerText = `TZS ${total.toLocaleString()}`;
}

// 4. Kutuma Form kwenda Server
document.getElementById('orderForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const orderData = {
        cropName: document.getElementById('modalCropName').innerText,
        sellerPhone: document.getElementById('modalSellerPhone').innerText,
        quantity: document.getElementById('orderQuantity').value,
        proposedPrice: document.getElementById('orderOfferedPrice').value,
        deliveryLocation: document.getElementById('deliveryLocation').value,
        buyerPhone: document.getElementById('buyerPhone').value,
        totalPrice: Number(document.getElementById('orderQuantity').value) * Number(document.getElementById('orderOfferedPrice').value)
    };

    try {
        const response = await fetch('/api/tuma-oda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert(`✅ Oda yako ya ${orderData.quantity} (${orderData.cropName}) imetumwa kikamilifu!\nMuuzaji atakutafuta hivi karibuni.`);
            closeOrderModal();
            document.getElementById('orderForm').reset();
        } else {
            alert(`❌ Imeshindwa kutuma: ${result.message}`);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("❌ Kuna tatizo la mtandao au server imefungwa.");
    }
});