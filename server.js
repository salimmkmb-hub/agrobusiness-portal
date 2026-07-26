const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();

// 1. Unganisha Firebase Admin SDK Safi
let serviceAccount;

try {
  // Jaribu kusoma secret file kwanza (Render Secret File au Local file)
  const secretPath = path.join(__dirname, 'serviceAccountKey.json');
 
  if (fs.existsSync(secretPath)) {
    serviceAccount = require(secretPath);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  }

  initializeApp({
    credential: cert(serviceAccount)
  });

  console.log("Firebase Admin SDK initialized successfully!");
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error.message);
}

const db = getFirestore();

// 2. Middlewares za kusoma data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 3. Weka folder la public kuwa static
app.use(express.static(path.join(__dirname, 'public')));

// 4. Route ya kurudisha index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Endpoint ya USSD
app.post('/ussd', async (req, res) => {
    // ONGEZA HII HEADER KUZUIA NGROK WARNING PAGE: //
    res.setHeader('ngrok-skip-browser-warning', 'true');
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    try {
        // 2. Safisha namba ya simu
        let cleanPhone = phoneNumber.replace(/\s+/g, '').replace('+255', '0').replace('255', '0');
        const userDoc = await db.collection('users').doc(cleanPhone).get();
        const isPaidUser = userDoc.exists && userDoc.data().status === 'PAID';

        // ====================================================
        // 1. IKIWA MTUMIAJI HAJALIPIA (UNPAID USER)
        // ====================================================
        if (!isPaidUser) {
            if (text === '') {
                response = `CON Welcome Agrobusiness software.
Akaunti yako haijashajiliwa.
Lipia TZS 1,000 kupata huduma za Soko.

1. Lipia Kujiunga (TZS 1,000)
2. Vigezo na Masharti
3. Msaada`;
            } else if (text === '1') {
                response = `END Ombi la malipo limetumwa kwenye simu yako (${cleanPhone}). Tafadhali ingiza PIN kisha upige tena kodi hii kuanza kutumia.`;
            } else if (text === '2') {
                response = `END Vigezo vya Agrobusiness Software:
- Lazima uwe Mkulima au Mvuvi.
- Ada ya kujiunga ni TZS 1,000 kwa mwezi.
- Mazao/Samaki lazima yawepo stoko.`;
            } else if (text === '3') {
                response = `END Kwa msaada zaidi piga namba: 0700000000 au tembelea https://www.agrobusinesssoftware.com.`;
            } else {
                response = `END Chaguo sio sahihi. Tafadhali jaribu tena.`;
            }
        }
        // ====================================================
        // 2. IKIWA MTUMIAJI AMESHALIPIA (PAID USER)
        // ====================================================
        else {
            const textArray = text.split('*');

            // --- MENYU KUU ---
            if (text === '') {
                response = `CON Welcome Agrobusiness software.
1. Weka Mazao/Samaki Sokoni
2. Angalia Bei za Masoko
3. Akaunti Yangu
4. Vigezo vya Mazao Sokoni`;
            }
            // --- OPTION 1: WEKA MAZAO / SAMAKI SOKONI ---
            else if (text === '1') {
                response = `CON Chagua aina ya Sekta:
1. Kilimo
2. Uvuvi
3. Ufugaji`;
            }
           
            // --- KILIMO MENU ---
            else if (text === '1*1') {
                response = `CON Chagua zao:
1. Mahindi
2. Mchele
3. Maharagwe
4. Nazi
5. Korosho
6. Ufuta
7. Mbaazi`;
            }

            // KILIMO: MAHINDI
else if (text === '1*1*1') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Mahindi:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '1') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '1') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Manyara, kiteto, Kihonda):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '1') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '1', textArray[2] = '1'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Mahindi',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Mahindi:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

            // KILIMO: MCHELE
           // Hatua ya 1: Mtumiaji kachagua Mchele (1*1*2)
else if (text === '1*1*2') {
    response = `CON Ingiza idadi ya Kilo (Kg) za Mchele:`;
}

// Hatua ya 2: Mtumiaji akiingiza Kilo
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '2') {
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// Hatua ya 3: Mtumiaji akiingiza Bei
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '2') {
    response = `CON Ingiza Eneo (Mfano: Mbeya, Kyela, Mbozi):`;
}

// Hatua ya 4: Mtumiaji akiingiza Eneo - SAVE TO FIRESTORE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '2') {
   
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
    const location = textArray[5] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Mchele',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Zao lako la Mchele:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

            // KILIMO: MAHARAGWE
                 else if (text === '1*1*3') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Maharage:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '3') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '3') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Mbeya, Rungwe, Tukuyu):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '3') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '1', textArray[2] = '3'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Maharage',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Maharage:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

// ZAO LA NAZI
 else if (text === '1*1*4') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Nazi:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '4') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '4') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Pwani, Mafia, kirongwe):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '4') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '1', textArray[2] = '4'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Nazi',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Nazi:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

// ZAO LA KOROSHO
 else if (text === '1*1*5') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Korosho:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '5') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '5') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Mtwara, Masasi, Chitohori):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '5') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '1', textArray[2] = '5'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Korosho',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Korosho:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

// ZAO LA UFUTA
 else if (text === '1*1*6') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Ufuta:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '6') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '6') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Liwale, Namtimbo, Kunyata):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '6') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '1', textArray[2] = '6'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Ufuta',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Ufuta:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

// ZAO LA MBaazi
 else if (text === '1*1*7') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Mbaazi:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '7') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '7') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Lindi, Nachingwea, Namapwia):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '1' && textArray[2] === '7') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '1', textArray[2] = '7'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Kilimo',
        item: 'Mbaazi',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Mbaazi:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

            // --- UVUVI MENU ---
            else if (text === '1*2') {
                response = `CON Chagua aina ya Samaki:
1. Sato
2. Sangara
3. Dagaa`;
            }

            // UVUVI: SATO
          // Hatua ya 1: Mtumiaji kachagua Sato
else if (text === '1*2*1') {
    response = `CON Ingiza idadi ya Kilo (Kg) za Sato:`;
}

// Hatua ya 2: Mtumiaji akiingiza Kilo
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '1') {
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// Hatua ya 3: Mtumiaji akiingiza Bei
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '1') {
    response = `CON Ingiza Eneo (Mfano: Mwanza, Ukerewe, Mwilu):`;
}

// Hatua ya 4: Mtumiaji akiingiza Eneo - SAVE TO FIRESTORE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '1') {

    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
    const location = textArray[5] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Uvuvi',
        item: 'Sato',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Zao lako la Sato:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}
            // UVUVI: SANGARA
            else if (text === '1*2*2') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Sangara:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '2') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '2') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Kigoma, Kasuru, Vipe):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '2') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '2', textArray[2] = '2'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Uvuvi',
        item: 'Sangara',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Sangara:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

            // UVUVI: DAGAA
            else if (text === '1*2*3') {
    // Hatua ya 1: Muombe ingiza Kilo
    response = `CON Ingiza idadi ya Kilo (Kg) za Dagaa:`;
}

// 2. Mtumiaji akiingiza Kilo (mfano ametuma "1000")
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '3') {
    // Hatua ya 2: Muombe ingiza Bei kwa Kilo
    response = `CON Ingiza Bei kwa Kilo 1 (TZS):`;
}

// 3. Mtumiaji akiingiza Bei (mfano ametuma "800")
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '3') {
    // Hatua ya 3: Muombe ingiza Mahali (Mkoa, Wilaya, Mtaa/Kijiji)
    response = `CON Ingiza Eneo (Mfano: Pwani, Bagamoyo, Dunda):`;
}

// 4. Mtumiaji akiingiza Eneo (mfano ametuma "Mbeya, Rungwe, Tukuyu") - SEHEMU YA KU-SAVE
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '2' && textArray[2] === '3') {
   
    // Kuchukua data kulingana na nafasi (index) zake kwenye array:
    // textArray[0] = '1', textArray[1] = '2', textArray[2] = '3'
    const kilo = textArray[3] || '0';
    const price = textArray[4] || '0';
   
    // Kwa sababu eneo linaweza kuwa na coma (,) au nyota, tunajiwekea ulinzi:
    const location = textArray[5] || 'Haikuwekwa';

    // Hifadhi kwenye Firestore Database
    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Uvuvi',
        item: 'Dagaa',
        quantityKg: Number(kilo),
        pricePerKg: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    // Ujumbe wa Mwisho wa Kuthibitisha
    response = `END Ahsante! Zao lako la Dagaa:
- Kiwango: ${kilo} Kg
- Bei kwa Kg: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}
  // ==========================================
// --- MIFUGO MENU (1*3) ---
// ==========================================
else if (text === '1*3') {
    response = `CON Chagua Mfugo:
1. Kuku
2. Bata
3. Kanga
4. Njiwa
5. Ng'ombe
6. Mbuzi
7. Kondoo`;
}

// ------------------------------------------
// 1. KUKU (1*3*1)
// ------------------------------------------
else if (text === '1*3*1') {
    response = `CON Chagua aina ya Kuku:
1. Kienyeji
2. Broiler`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '1') {
    response = `CON Ingiza idadi ya Kuku:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '1') {
    response = `CON Ingiza Bei kwa Kuku 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '1') {
    response = `CON Ingiza Eneo (Mfano: Mwanza, Misungwi):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '1') {

    const subTypeOption = textArray[3]; // 1 = Kienyeji, 2 = Broiler
    const subType = subTypeOption === '1' ? 'Kienyeji' : 'Broiler';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Kuku (${subType})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Kuku wako (${subType}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Wamesajiliwa sokoni kikamilifu.`;
}

// ------------------------------------------
// 2. Bata (1*3*2)
// ------------------------------------------
else if (text === '1*3*2') {
    response = `CON Chagua aina ya Bata:
1. Bata Mzinga
2. Bata Maji`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '2') {
    response = `CON Ingiza idadi ya Bata:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '2') {
    response = `CON Ingiza Bei kwa Bata 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '2') {
    response = `CON Ingiza Eneo (Mfano: Mwanza, Misungwi):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '2') {

    const subTypeOption = textArray[3]; // 1 = Bata Mzinga, 2 = Bata Maji
    const subType = subTypeOption === '1' ? 'Bata Mzinga' : 'Bata Maji';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Bata (${subType})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Bata wako (${subType}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Wamesajiliwa sokoni kikamilifu.`;
}

// ------------------------------------------
// 3. KANGA (1*3*3)
// ------------------------------------------
else if (text === '1*3*3') {
    response = `CON Chagua aina ya Kanga:
1. Kanga Mweupe
2. Kanga wa Madoa`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '3') {
    response = `CON Ingiza idadi ya Kanga:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '3') {
    response = `CON Ingiza Bei kwa Kanga 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '3') {
    response = `CON Ingiza Eneo (Mfano: Mkoa, Wilaya, Kijiji/Mtaa):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '3') {

    const subTypeOption = textArray[3]; // 1 = Kienyeji, 2 = Broiler
    const subType = subTypeOption === '1' ? 'Mweupe' : 'wa Madoa';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Kanga (${subType})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Kanga wako (${subType}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Wamesajiliwa sokoni kikamilifu.`;
}

// ------------------------------------------
// 4. NJIWA (1*3*4)
// ------------------------------------------
else if (text === '1*3*4') {
    response = `CON Chagua aina ya Njiwa:
1. Njiwa Mweupe
2. Njiwa wa Madoa`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '4') {
    response = `CON Ingiza idadi ya Njiwa:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '4') {
    response = `CON Ingiza Bei kwa Njiwa 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '4') {
    response = `CON Ingiza Eneo (Mfano: Mwanza, Misungwi):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '4') {

    const subTypeOption = textArray[3]; // 1 = Kienyeji, 2 = Broiler
    const subType = subTypeOption === '1' ? 'Kienyeji' : 'Broiler';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Njiwa (${subType})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Njiwa wako (${subType}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Wamesajiliwa sokoni kikamilifu.`;
}
// ------------------------------------------
// 5. NG'OMBE (1*3*5) - Mfano wa Mnyama (Dume / Jike)
// ------------------------------------------
else if (text === '1*3*5') {
    response = `CON Chagua Jinsia ya Ng'ombe:
1. Dume
2. Jike`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '5') {
    response = `CON Ingiza idadi ya Ng'ombe:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '5') {
    response = `CON Ingiza Bei kwa Ng'ombe 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '5') {
    response = `CON Ingiza Eneo (Mfano: Shinyanga, Kishapu):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '5') {

    const genderOption = textArray[3]; // 1 = Dume, 2 = Jike
    const gender = genderOption === '1' ? 'Dume' : 'Jike';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Ng'ombe (${gender})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Ng'ombe (${gender}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

// ------------------------------------------
// 6. MBUZI (1*3*6) - Mnyama (Dume / Jike)
// ------------------------------------------
else if (text === '1*3*6') {
    response = `CON Chagua Jinsia ya Mbuzi:
1. Dume
2. Jike`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '6') {
    response = `CON Ingiza idadi ya Mbuzi:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '6') {
    response = `CON Ingiza Bei kwa Mbuzi 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '6') {
    response = `CON Ingiza Eneo (Mfano: Dodoma, Kongwa):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '6') {

    const genderOption = textArray[3]; // 1 = Dume, 2 = Jike
    const gender = genderOption === '1' ? 'Dume' : 'Jike';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Mbuzi (${gender})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Mbuzi (${gender}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}

// ------------------------------------------
// 6. KONDOO (1*3*7) - Mnyama (Dume / Jike)
// ------------------------------------------
else if (text === '1*3*7') {
    response = `CON Chagua Jinsia ya Kondoo:
1. Dume
2. Jike`;
}
else if (textArray.length === 4 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '7') {
    response = `CON Ingiza idadi ya Kondoo:`;
}
else if (textArray.length === 5 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '7') {
    response = `CON Ingiza Bei kwa Kondoo 1 (TZS):`;
}
else if (textArray.length === 6 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '7') {
    response = `CON Ingiza Eneo (Mfano: Dodoma, Kongwa):`;
}
else if (textArray.length === 7 && textArray[0] === '1' && textArray[1] === '3' && textArray[2] === '7') {

    const genderOption = textArray[3]; // 1 = Dume, 2 = Jike
    const gender = genderOption === '1' ? 'Dume' : 'Jike';
    const quantity = textArray[4] || '0';
    const price = textArray[5] || '0';
    const location = textArray[6] || 'Haikuwekwa';

    await db.collection('products').add({
        phoneNumber: cleanPhone,
        category: 'Mifugo',
        item: `Kondoo (${gender})`,
        quantity: Number(quantity),
        pricePerUnit: Number(price),
        location: location,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    });

    response = `END Ahsante! Kondoo (${gender}):
- Idadi: ${quantity}
- Bei kwa Mfugo 1: TZS ${price}
- Eneo: ${location}
Limesajiliwa sokoni kikamilifu.`;
}
            // --- OPTION 2: BEI ZA MASOKO ---
            else if (text === '2') {
                response = `END Bei za Leo Sokoni:
- Mahindi: TZS 800/kg
- Mchele: TZS 2,500/kg
- Maharagwe: TZS 1,800/kg
- Sato: TZS 9,000/kg
- Sangara: TZS 8,000/kg
- Dagaa: TZS 5,000/kg`;
            }

            // --- OPTION 3: AKAUNTI YANGU ---
            else if (text === '3') {
                response = `END Taarifa za Akaunti:
Namba: ${cleanPhone}
Hali: Mwanachama Aliyesajiliwa (Active)`;
            }

            // --- OPTION 4: VIGEZO VYA MAZAO ---
            else if (text === '4') {
                response = `END Vigezo vya Mazao Sokoni:
- Mazao lazima yaanzie Kg 1000, Samaki Kg 1000.
- Lazima uwe mshiriki halisi.
- Mazao lazima yawe na muda wa (Mwezi 1 hadi miezi 3).`;
            }

            else {
                response = `END Chaguo sio sahihi. Tafadhali jaribu tena.`;
            }
        }

    } catch (error) {
        console.error("Firebase Error:", error);
        response = `END Kutokana na tatizo la kiufundi, mfumo haupatikani kwa sasa.`;
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// ====================================================
// API ENDPOINT YA WEBSITE (KUVUTA MAZAO YOTE FIRESTORE)
// ====================================================
app.get('/api/products', async (req, res) => {
    try {
        const snapshot = await db.collection('products').where('status', '==', 'AVAILABLE').get();
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, message: "Imeshindikana kupata mazao" });
    }
});

// Anzisha Server kwenye Port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ya Agribusiness inaendeshwa kwenye port ${PORT}`);
});
// Endpoint ya Kusajili Wanunuzi kutoka Website
app.post('/api/register-buyer', async (req, res) => {
    try {
        const { name, phone, location, registeredAt } = req.body;
       
        await db.collection('buyers').add({
            name,
            phone,
            location,
            registeredAt: registeredAt || new Date().toISOString()
        });

        res.status(200).json({ success: true, message: 'Mnunuzi amesajiliwa kikamilifu' });
    } catch (error) {
        console.error('Error saving buyer:', error);
        res.status(500).json({ success: false, message: 'Imeshindwa kusajili mnunuzi' });
    }
});
// Endpoint ya Kusajili Mnunuzi aliyelipia
app.post('/api/register-buyer', async (req, res) => {
    try {
        const { name, phone, location, verificationCode } = req.body;

        if (!verificationCode || verificationCode.trim() === '') {
            return res.status(400).json({ success: false, message: 'Tafadhali ingiza kodi ya uhakiki' });
        }

        // Hifadhi kwenye Firestore Collection ya 'buyers'
        await db.collection('buyers').add({
            name: name,
            phoneNumber: phone,
            location: location,
            verificationCode: verificationCode,
            paymentStatus: 'PAID', // Inaainisha kuwa amelipia
            registeredAt: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: 'Mnunuzi amesajiliwa kikamilifu'
        });

    } catch (error) {
        console.error('Error saving buyer to Firestore:', error);
        res.status(500).json({ success: false, message: 'Kosa la server, jaribu tena.' });
    }
});
// 1. Endpoint ya Usajili (Register + Save Password)
app.post('/api/register-buyer', async (req, res) => {
    try {
        const { name, phone, password, location, verificationCode } = req.body;

        await db.collection('buyers').add({
            name,
            phoneNumber: phone,
            password: password, // Kwenye mfumo mkubwa unaweza ku-hash nenosiri hapa
            location,
            verificationCode,
            paymentStatus: 'PAID',
            createdAt: new Date().toISOString()
        });

        res.status(200).json({ success: true, message: 'Usajili umekamilika!' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Kosa la server' });
    }
});

// 2. Endpoint ya Kuingia (Login)
app.post('/api/login-buyer', async (req, res) => {
    try {
        const { phone, password } = req.body;

        const snapshot = await db.collection('buyers')
            .where('phoneNumber', '==', phone)
            .where('password', '==', password)
            .get();

        if (snapshot.empty) {
            return res.status(401).json({ success: false, message: 'Namba ya simu au nenosiri si sahihi!' });
        }

        res.status(200).json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Kosa la server' });
    }
});

// Route ya kupokea Oda na kutuma taarifa kwa muuzaji
app.post('/api/tuma-oda', (req, res) => {
    try {
        const { cropName, defaultPrice, proposedPrice, totalPrice, quantity, sellerPhone, buyerPhone } = req.body;
       
        console.log("\n================ ODA MPYA ===============");
        console.log(`Zao: ${cropName}`);
        console.log(`Kiasi: ${quantity}`);
        console.log(`Bei ya Muuzaji: TZS ${defaultPrice}`);
        console.log(`Offer ya Mnunuzi: TZS ${proposedPrice}`);
        console.log(`Jumla ya Pesa: TZS ${totalPrice}`);
        console.log(`Simu ya Muuzaji: ${sellerPhone}`);
        console.log(`Simu ya Mnunuzi: ${buyerPhone}`);
        console.log("==========================================\n");

        res.status(200).json({
            success: true,
            message: "Oda imethibitishwa kikamilifu!"
        });
    } catch (error) {
        console.error("Error kwenye oda:", error);
        res.status(500).json({
            success: false,
            message: "Kuna tatizo lililotokea kwenye server."
        });
    }
});