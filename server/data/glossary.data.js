// server/data/glossary.data.js
// Seed source for the `glossary` table. Plain-language explanations of the
// financial terms the UI links to, in every supported language.
// Key order below becomes sort_order in the database.

export const glossarySeed = {
  moratorium: {
    en: {
      term: "Moratorium",
      plain: "A grace period at the start of your loan where you only pay interest — not the main loan amount. This gives you time to set up your business or finish your course before full EMIs begin.",
      example: "If your loan has a 6-month moratorium, you pay only interest for 6 months, then regular EMIs start from month 7.",
    },
    hi: {
      term: "स्थगन अवधि",
      plain: "आपके ऋण की शुरुआत में एक छूट अवधि जहाँ आप केवल ब्याज चुकाते हैं — मूल ऋण राशि नहीं। इससे आपको अपना व्यवसाय स्थापित करने या पाठ्यक्रम पूरा करने का समय मिलता है।",
      example: "यदि आपके ऋण में 6 महीने की स्थगन अवधि है, तो आप 6 महीने तक केवल ब्याज चुकाएँगे, फिर 7वें महीने से नियमित EMI शुरू होगी।",
    },
    mr: {
      term: "स्थगिती कालावधी",
      plain: "तुमच्या कर्जाच्या सुरुवातीला एक सवलत कालावधी जिथे तुम्ही फक्त व्याज भरता — मूळ कर्ज रक्कम नाही. यामुळे तुम्हाला तुमचा व्यवसाय सुरू करण्यासाठी किंवा अभ्यासक्रम पूर्ण करण्यासाठी वेळ मिळतो.",
      example: "जर तुमच्या कर्जात ६ महिन्यांची स्थगिती असेल, तर तुम्ही ६ महिने फक्त व्याज भरता, मग ७व्या महिन्यापासून नियमित EMI सुरू होतो.",
    },
  },

  npa: {
    en: {
      term: "NPA (Non-Performing Asset)",
      plain: "A loan that the borrower has stopped repaying for 90+ days. Banks with high NPAs are riskier — they may delay your loan or have poor service. We filter out high-NPA partners to protect you.",
      example: "If a bank's NPA rate is 15%, it means 15 out of every 100 loans are not being repaid. That's a warning sign.",
    },
    hi: {
      term: "NPA (गैर-निष्पादित संपत्ति)",
      plain: "एक ऐसा ऋण जिसे उधारकर्ता ने 90+ दिनों से चुकाना बंद कर दिया है। उच्च NPA वाले बैंक जोखिम भरे होते हैं — वे आपके ऋण में देरी कर सकते हैं। हम आपकी सुरक्षा के लिए उच्च-NPA भागीदारों को बाहर रखते हैं।",
      example: "यदि किसी बैंक की NPA दर 15% है, तो इसका मतलब है कि हर 100 ऋणों में से 15 की चुकौती नहीं हो रही। यह एक चेतावनी संकेत है।",
    },
    mr: {
      term: "NPA (नॉन-परफॉर्मिंग अॅसेट)",
      plain: "एक कर्ज जे कर्जदाराने ९०+ दिवसांपासून फेडणे थांबवले आहे. जास्त NPA असलेल्या बँका जोखमीच्या असतात — त्या तुमच्या कर्जात विलंब करू शकतात. तुमच्या सुरक्षेसाठी आम्ही जास्त-NPA भागीदारांना वगळतो.",
      example: "जर एका बँकेचा NPA दर १५% असेल, तर याचा अर्थ प्रत्येक १०० कर्जांपैकी १५ कर्जांची परतफेड होत नाही. हा एक इशारा आहे.",
    },
  },

  concessional: {
    en: {
      term: "Concessional Interest",
      plain: "An interest rate that is lower than what regular banks charge. Government schemes offer concessional rates to make loans affordable for SC entrepreneurs and students.",
      example: "A regular business loan might charge 12–14%, but a concessional scheme might charge only 5–6.5%. That saves you lakhs over the loan's lifetime.",
    },
    hi: {
      term: "रियायती ब्याज",
      plain: "एक ब्याज दर जो सामान्य बैंकों द्वारा ली जाने वाली दर से कम है। सरकारी योजनाएँ SC उद्यमियों और छात्रों के लिए ऋण को सस्ता बनाने हेतु रियायती दरें प्रदान करती हैं।",
      example: "एक सामान्य व्यावसायिक ऋण पर 12–14% ब्याज लग सकता है, लेकिन रियायती योजना में केवल 5–6.5% लगता है। इससे ऋण की अवधि में लाखों की बचत होती है।",
    },
    mr: {
      term: "सवलतीचे व्याज",
      plain: "एक व्याज दर जो सामान्य बँकांच्या दरापेक्षा कमी आहे. सरकारी योजना SC उद्योजक आणि विद्यार्थ्यांसाठी कर्ज परवडणारे करण्यासाठी सवलतीचे दर देतात.",
      example: "सामान्य व्यावसायिक कर्जावर १२–१४% व्याज लागू शकते, पण सवलतीच्या योजनेत फक्त ५–६.५% लागते. यामुळे कर्जाच्या कालावधीत लाखोंची बचत होते.",
    },
  },

  channelPartner: {
    en: {
      term: "Channel Partner",
      plain: "A bank or financial institution that works with the government to distribute (disburse) scheme loans to eligible SC applicants. They process your application and release the funds.",
      example: "SBI, Bank of Baroda, and state SC corporations are channel partners. You apply through them, not directly to the government.",
    },
    hi: {
      term: "चैनल पार्टनर",
      plain: "एक बैंक या वित्तीय संस्था जो सरकार के साथ मिलकर पात्र SC आवेदकों को योजना ऋण वितरित करती है। वे आपके आवेदन की प्रक्रिया करते हैं और धनराशि जारी करते हैं।",
      example: "SBI, बैंक ऑफ बड़ौदा और राज्य SC निगम चैनल पार्टनर हैं। आप उनके माध्यम से आवेदन करते हैं, सीधे सरकार से नहीं।",
    },
    mr: {
      term: "चॅनेल पार्टनर",
      plain: "एक बँक किंवा वित्तीय संस्था जी पात्र SC अर्जदारांना योजना कर्ज वाटप करण्यासाठी सरकारसोबत काम करते. ते तुमचा अर्ज प्रक्रिया करतात आणि निधी वितरित करतात.",
      example: "SBI, बँक ऑफ बडोदा आणि राज्य SC महामंडळे चॅनेल पार्टनर आहेत. तुम्ही त्यांच्यामार्फत अर्ज करता, थेट सरकारकडे नाही.",
    },
  },

  sca: {
    en: {
      term: "SCA (State Channelising Agency)",
      plain: "A state government body (usually called SC Development Corporation) that channels central government funds to SC beneficiaries in that state. Each state has its own SCA.",
      example: "Maharashtra SC Finance Corporation is the SCA for Maharashtra. They receive funds from NSFDC and lend to SC entrepreneurs in the state.",
    },
    hi: {
      term: "SCA (राज्य चैनलाइज़िंग एजेंसी)",
      plain: "एक राज्य सरकारी निकाय (आमतौर पर SC विकास निगम) जो उस राज्य में SC लाभार्थियों तक केंद्र सरकार के धन को पहुँचाता है। प्रत्येक राज्य का अपना SCA होता है।",
      example: "महाराष्ट्र SC वित्त निगम महाराष्ट्र का SCA है। वे NSFDC से धन प्राप्त करते हैं और राज्य में SC उद्यमियों को ऋण देते हैं।",
    },
    mr: {
      term: "SCA (राज्य चॅनेलायझिंग एजन्सी)",
      plain: "एक राज्य सरकारी संस्था (सामान्यतः SC विकास महामंडळ) जी त्या राज्यातील SC लाभार्थ्यांपर्यंत केंद्र सरकारचे निधी पोहोचवते. प्रत्येक राज्याचे स्वतःचे SCA असते.",
      example: "महाराष्ट्र SC वित्त महामंडळ हे महाराष्ट्राचे SCA आहे. ते NSFDC कडून निधी प्राप्त करतात आणि राज्यातील SC उद्योजकांना कर्ज देतात.",
    },
  },

  emi: {
    en: {
      term: "EMI (Equated Monthly Instalment)",
      plain: "The fixed amount you pay every month to repay your loan. It includes both a part of the principal (main loan) and the interest. The amount stays the same each month.",
      example: "If your EMI is ₹3,500, you pay exactly ₹3,500 every month for the entire loan tenure.",
    },
    hi: {
      term: "EMI (समान मासिक किस्त)",
      plain: "वह निश्चित राशि जो आप हर महीने अपने ऋण की चुकौती के लिए चुकाते हैं। इसमें मूलधन और ब्याज दोनों का हिस्सा शामिल होता है। राशि हर महीने समान रहती है।",
      example: "यदि आपकी EMI ₹3,500 है, तो आप पूरी ऋण अवधि तक हर महीने ठीक ₹3,500 चुकाते हैं।",
    },
    mr: {
      term: "EMI (समान मासिक हप्ता)",
      plain: "तुमच्या कर्जाची परतफेड करण्यासाठी तुम्ही दरमहा भरत असलेली निश्चित रक्कम. यात मूळ रक्कम आणि व्याज दोन्हींचा भाग असतो. रक्कम दरमहा सारखीच राहते.",
      example: "जर तुमचा EMI ₹३,५०० असेल, तर तुम्ही संपूर्ण कर्ज कालावधीसाठी दरमहा नेमके ₹३,५०० भरता.",
    },
  },

  collateral: {
    en: {
      term: "Collateral",
      plain: "Property or assets (like land, house, or fixed deposits) that you pledge as security for a loan. If you don't repay, the bank can sell it. Many SC schemes are collateral-free.",
      example: "A regular bank loan might require your house as collateral. But Stand Up India and Mudra loans don't need any collateral up to ₹10 lakh.",
    },
    hi: {
      term: "संपार्श्विक (गिरवी)",
      plain: "संपत्ति या संपत्तियाँ (जैसे ज़मीन, मकान, या एफडी) जो आप ऋण के लिए सुरक्षा के रूप में गिरवी रखते हैं। यदि आप चुकौती नहीं करते, तो बैंक इसे बेच सकता है। कई SC योजनाएँ बिना गिरवी के हैं।",
      example: "एक सामान्य बैंक ऋण के लिए आपके मकान को गिरवी रखना पड़ सकता है। लेकिन स्टैंड अप इंडिया और मुद्रा ऋण में ₹10 लाख तक कोई गिरवी नहीं चाहिए।",
    },
    mr: {
      term: "तारण (कॉलॅटरल)",
      plain: "मालमत्ता किंवा संपत्ती (जसे जमीन, घर, किंवा एफडी) जी तुम्ही कर्जासाठी सुरक्षा म्हणून तारण ठेवता. जर तुम्ही परतफेड केली नाही, तर बँक ती विकू शकते. अनेक SC योजना तारणमुक्त आहेत.",
      example: "सामान्य बँक कर्जासाठी तुमचे घर तारण ठेवावे लागू शकते. पण स्टँड अप इंडिया आणि मुद्रा कर्जात ₹१० लाखांपर्यंत कोणतेही तारण लागत नाही.",
    },
  },
};

export const glossaryLanguages = ["en", "hi", "mr"];
