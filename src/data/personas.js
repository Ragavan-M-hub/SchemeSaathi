// src/data/personas.js
// Pre-filled personas for hackathon demos. Clicking one auto-fills the
// Recommender form and jumps straight to results.

export const personas = [
  {
    id: "ravi-tailor",
    emoji: "🧵",
    label: {
      en: "Ravi, tailor, needs ₹1.2L for his shop",
      hi: "रवि, दर्ज़ी, अपनी दुकान के लिए ₹1.2L चाहिए",
      mr: "रवी, शिंपी, त्याच्या दुकानासाठी ₹१.२L हवे आहे",
    },
    form: {
      purpose: "self-employment",
      projectType: "Tailoring / boutique",
      cost: 120000,
      income: 180000,
      education: "10th",
      gender: "male",
    },
  },
  {
    id: "priya-abroad",
    emoji: "🎓",
    label: {
      en: "Priya, wants ₹8L for studies abroad",
      hi: "प्रिया, विदेश में पढ़ाई के लिए ₹8L चाहती हैं",
      mr: "प्रिया, परदेशातील शिक्षणासाठी ₹८L हवी आहे",
    },
    form: {
      purpose: "higher-education",
      projectType: "Studies abroad (Master's / PhD)",
      cost: 800000,
      income: 240000,
      education: "graduate",
      gender: "female",
    },
  },
  {
    id: "anita-salon",
    emoji: "💇‍♀️",
    label: {
      en: "Anita, SC woman, wants ₹1L for a salon",
      hi: "अनीता, SC महिला, सैलून के लिए ₹1L चाहती हैं",
      mr: "अनिता, SC महिला, सलूनसाठी ₹१L हवी आहे",
    },
    form: {
      purpose: "self-employment",
      projectType: "Beauty parlour / salon",
      cost: 100000,
      income: 150000,
      education: "12th",
      gender: "female",
    },
  },
  {
    id: "suresh-skill",
    emoji: "🛠️",
    label: {
      en: "Suresh, wants ₹40K for ITI training",
      hi: "सुरेश, ITI प्रशिक्षण के लिए ₹40K चाहते हैं",
      mr: "सुरेश, ITI प्रशिक्षणासाठी ₹४०K हवे आहे",
    },
    form: {
      purpose: "skill-training",
      projectType: "ITI / polytechnic diplomas",
      cost: 40000,
      income: 120000,
      education: "10th",
      gender: "male",
    },
  },
];

export const getPersonaById = (id) => personas.find((p) => p.id === id);