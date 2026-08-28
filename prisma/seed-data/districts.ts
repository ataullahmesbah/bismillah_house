/**
 * All 64 districts of Bangladesh, grouped by division.
 * Delivery charges are stored in minor units (poisha): 6000 = ৳60.
 */
export type SeedDistrict = { name: string; nameBn: string; division: string };

export const BANGLADESH_DISTRICTS: SeedDistrict[] = [
  { name: "Barguna", nameBn: "বরগুনা", division: "Barishal" },
  { name: "Barishal", nameBn: "বরিশাল", division: "Barishal" },
  { name: "Bhola", nameBn: "ভোলা", division: "Barishal" },
  { name: "Jhalokati", nameBn: "ঝালকাঠি", division: "Barishal" },
  { name: "Patuakhali", nameBn: "পটুয়াখালী", division: "Barishal" },
  { name: "Pirojpur", nameBn: "পিরোজপুর", division: "Barishal" },

  { name: "Bandarban", nameBn: "বান্দরবান", division: "Chattogram" },
  { name: "Brahmanbaria", nameBn: "ব্রাহ্মণবাড়িয়া", division: "Chattogram" },
  { name: "Chandpur", nameBn: "চাঁদপুর", division: "Chattogram" },
  { name: "Chattogram", nameBn: "চট্টগ্রাম", division: "Chattogram" },
  { name: "Cumilla", nameBn: "কুমিল্লা", division: "Chattogram" },
  { name: "Cox's Bazar", nameBn: "কক্সবাজার", division: "Chattogram" },
  { name: "Feni", nameBn: "ফেনী", division: "Chattogram" },
  { name: "Khagrachhari", nameBn: "খাগড়াছড়ি", division: "Chattogram" },
  { name: "Lakshmipur", nameBn: "লক্ষ্মীপুর", division: "Chattogram" },
  { name: "Noakhali", nameBn: "নোয়াখালী", division: "Chattogram" },
  { name: "Rangamati", nameBn: "রাঙ্গামাটি", division: "Chattogram" },

  { name: "Dhaka", nameBn: "ঢাকা", division: "Dhaka" },
  { name: "Faridpur", nameBn: "ফরিদপুর", division: "Dhaka" },
  { name: "Gazipur", nameBn: "গাজীপুর", division: "Dhaka" },
  { name: "Gopalganj", nameBn: "গোপালগঞ্জ", division: "Dhaka" },
  { name: "Kishoreganj", nameBn: "কিশোরগঞ্জ", division: "Dhaka" },
  { name: "Madaripur", nameBn: "মাদারীপুর", division: "Dhaka" },
  { name: "Manikganj", nameBn: "মানিকগঞ্জ", division: "Dhaka" },
  { name: "Munshiganj", nameBn: "মুন্সীগঞ্জ", division: "Dhaka" },
  { name: "Narayanganj", nameBn: "নারায়ণগঞ্জ", division: "Dhaka" },
  { name: "Narsingdi", nameBn: "নরসিংদী", division: "Dhaka" },
  { name: "Rajbari", nameBn: "রাজবাড়ী", division: "Dhaka" },
  { name: "Shariatpur", nameBn: "শরীয়তপুর", division: "Dhaka" },
  { name: "Tangail", nameBn: "টাঙ্গাইল", division: "Dhaka" },

  { name: "Bagerhat", nameBn: "বাগেরহাট", division: "Khulna" },
  { name: "Chuadanga", nameBn: "চুয়াডাঙ্গা", division: "Khulna" },
  { name: "Jashore", nameBn: "যশোর", division: "Khulna" },
  { name: "Jhenaidah", nameBn: "ঝিনাইদহ", division: "Khulna" },
  { name: "Khulna", nameBn: "খুলনা", division: "Khulna" },
  { name: "Kushtia", nameBn: "কুষ্টিয়া", division: "Khulna" },
  { name: "Magura", nameBn: "মাগুরা", division: "Khulna" },
  { name: "Meherpur", nameBn: "মেহেরপুর", division: "Khulna" },
  { name: "Narail", nameBn: "নড়াইল", division: "Khulna" },
  { name: "Satkhira", nameBn: "সাতক্ষীরা", division: "Khulna" },

  { name: "Jamalpur", nameBn: "জামালপুর", division: "Mymensingh" },
  { name: "Mymensingh", nameBn: "ময়মনসিংহ", division: "Mymensingh" },
  { name: "Netrokona", nameBn: "নেত্রকোণা", division: "Mymensingh" },
  { name: "Sherpur", nameBn: "শেরপুর", division: "Mymensingh" },

  { name: "Bogura", nameBn: "বগুড়া", division: "Rajshahi" },
  { name: "Chapai Nawabganj", nameBn: "চাঁপাইনবাবগঞ্জ", division: "Rajshahi" },
  { name: "Joypurhat", nameBn: "জয়পুরহাট", division: "Rajshahi" },
  { name: "Naogaon", nameBn: "নওগাঁ", division: "Rajshahi" },
  { name: "Natore", nameBn: "নাটোর", division: "Rajshahi" },
  { name: "Pabna", nameBn: "পাবনা", division: "Rajshahi" },
  { name: "Rajshahi", nameBn: "রাজশাহী", division: "Rajshahi" },
  { name: "Sirajganj", nameBn: "সিরাজগঞ্জ", division: "Rajshahi" },

  { name: "Dinajpur", nameBn: "দিনাজপুর", division: "Rangpur" },
  { name: "Gaibandha", nameBn: "গাইবান্ধা", division: "Rangpur" },
  { name: "Kurigram", nameBn: "কুড়িগ্রাম", division: "Rangpur" },
  { name: "Lalmonirhat", nameBn: "লালমনিরহাট", division: "Rangpur" },
  { name: "Nilphamari", nameBn: "নীলফামারী", division: "Rangpur" },
  { name: "Panchagarh", nameBn: "পঞ্চগড়", division: "Rangpur" },
  { name: "Rangpur", nameBn: "রংপুর", division: "Rangpur" },
  { name: "Thakurgaon", nameBn: "ঠাকুরগাঁও", division: "Rangpur" },

  { name: "Habiganj", nameBn: "হবিগঞ্জ", division: "Sylhet" },
  { name: "Moulvibazar", nameBn: "মৌলভীবাজার", division: "Sylhet" },
  { name: "Sunamganj", nameBn: "সুনামগঞ্জ", division: "Sylhet" },
  { name: "Sylhet", nameBn: "সিলেট", division: "Sylhet" },
];
