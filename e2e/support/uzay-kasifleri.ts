/*
 * "Uzay Kâşifleri" — the 10 space discoveries (docs/rapor/uzay) as Studio input.
 * Each discovery becomes one card; its interaction is mapped to the closest block:
 *  • one-answer questions with emoji buttons → "Doğruları seç" (choose-correct),
 *  • questions whose answers are too long for a button (> 24 chars) → "Quiz",
 *  • the planet order → "Sıralama" (8 items), the final 5-question mission → "Eşleştirme".
 * Question cards show the card icon big on the "Emoji sahnesi" library scene.
 */

/** Card icon: from the picker's emoji sets, or typed into "Başka bir emoji". */
export type IconPick = { emoji: string; custom?: true }

type CardBase = {
  title: string
  icon: IconPick
  /** "Keşif" text — the answer box under the interaction. */
  answer: string
  narration: string
  hint: string
  celebration: string
}

export type ChooseCard = CardBase & {
  kind: 'choose'
  prompt: string
  options: { label: string; icon: string; correct: boolean; feedback: string }[]
  success: string
}

export type QuizCard = CardBase & {
  kind: 'quiz'
  question: string
  options: string[]
  correct: number
  explanation: string
}

export type SequenceCard = CardBase & {
  kind: 'sequence'
  prompt: string
  items: { label: string; icon: string }[]
  success: string
}

export type MatchingCard = CardBase & {
  kind: 'matching'
  prompt: string
  pairs: { left: string; right: string }[]
  success: string
}

export type UzayCard = ChooseCard | QuizCard | SequenceCard | MatchingCard

export const BLOCK_LABELS: Record<UzayCard['kind'], string> = {
  choose: 'Doğruları seç',
  quiz: 'Quiz',
  sequence: 'Sıralama',
  matching: 'Eşleştirme',
}

export const UZAY_KIT = {
  title: 'Uzay Kâşifleri',
  slug: 'uzay-kasifleri',
  qrPrefix: 'UZAY',
  icon: '🚀',
  tagline: 'İlkokul için 10 keşiflik Güneş Sistemi macerası',
  description:
    'Dünya, Güneş, Ay ve gezegenleri keşfet; roketlerin nasıl uçtuğunu ve uzayda neden ses duyulmadığını öğren. **10 keşfi** tamamlayan **Uzay Kâşifi** rozetini kazanır!',
  category: 'Uzay',
  ageMin: '6',
  ageMax: '10',
  duration: '25',
  theme: 'Uzay',
  badge: {
    name: 'Uzay Kâşifi',
    emoji: '🚀',
    description: 'Güneş Sistemi’ni keşfeden meraklı bilim insanı!',
  },
} as const

export const PLANETS = [
  { label: 'Merkür', icon: '🌑' },
  { label: 'Venüs', icon: '🟡' },
  { label: 'Dünya', icon: '🌍' },
  { label: 'Mars', icon: '🔴' },
  { label: 'Jüpiter', icon: '🟠' },
  { label: 'Satürn', icon: '🪐' },
  { label: 'Uranüs', icon: '🔵' },
  { label: 'Neptün', icon: '🌀' },
]

export const UZAY_CARDS: UzayCard[] = [
  {
    kind: 'choose',
    title: 'Dünya Nedir?',
    icon: { emoji: '🌍' },
    answer:
      'Dünya, üzerinde yaşadığımız **gezegendir**. Üzerinde hava, su, toprak, bitkiler, hayvanlar ve insanlar bulunur.',
    narration:
      'Dünya, üzerinde yaşadığımız gezegendir. Dünya’nın büyük bir kısmını ne kaplar? Doğru olana dokun!',
    hint: '🌍 Dünya’ya bak, sonra doğru cevaba dokun!',
    celebration: '🌍💧 Harika!',
    prompt: 'Dünya’nın büyük bir kısmını ne kaplar?',
    options: [
      { label: 'Su', icon: '🟦', correct: true, feedback: '💧 Evet, su!' },
      { label: 'Kum', icon: '🟫', correct: false, feedback: '🏜️ Kum o kadar çok yer kaplamaz!' },
      {
        label: 'Orman',
        icon: '🟩',
        correct: false,
        feedback: '🌳 Ormanlar güzel ama en çok o değil!',
      },
    ],
    success: 'Harika! Dünya’nın yüzeyinin büyük bölümü sularla kaplıdır. 🌍💧',
  },
  {
    kind: 'quiz',
    title: 'Güneş Nedir?',
    icon: { emoji: '☀️' },
    answer: 'Güneş bize **ışık ve ısı** veren çok büyük bir yıldızdır.',
    narration: 'Güneş bize ışık ve ısı verir. Peki Güneş nedir?',
    hint: '☀️ Güneş’e bak, sonra cevabını seç!',
    celebration: '⭐ Parladın!',
    question: 'Güneş nedir?',
    options: ['🌟 Bir yıldız', '🌍 Bir gezegen', '🚀 Bir uzay gemisi'],
    correct: 0,
    explanation: 'Güneş, bize ışık ve ısı veren çok büyük bir yıldızdır. ⭐',
  },
  {
    kind: 'quiz',
    title: 'Ay Neden Parlar?',
    icon: { emoji: '🌙' },
    answer:
      'Ay kendi ışığını **üretmez**. Güneş’ten gelen ışığı yansıttığı için geceleri parlak görünür. ☀️ → 🌙',
    narration: 'Ay kendi ışığını üretmez. Ay’ın ışığı nereden gelir?',
    hint: '☀️ → 🌙 Işığın yolunu düşün!',
    celebration: '🌙 Işıl ışıl!',
    question: 'Ay’ın ışığı nereden gelir?',
    options: ['☀️ Güneş’ten', '🌍 Dünya’dan', '⭐ Yıldızlardan'],
    correct: 0,
    explanation: 'Ay, Güneş’ten gelen ışığı yansıtır; bu yüzden geceleri parlar.',
  },
  {
    kind: 'sequence',
    title: 'Gezegenler',
    icon: { emoji: '🪐' },
    answer:
      'Güneş’in etrafında dolanan büyük gök cisimlerine **gezegen** denir. Güneş Sistemi’nde **8 gezegen** vardır.',
    narration:
      'Güneş Sistemi’nde sekiz gezegen vardır. Gezegenleri Güneş’e en yakından en uzağa doğru sırala.',
    hint: '☀️ Güneş’e en yakın gezegenden başla!',
    celebration: '🪐 Süper sıralama!',
    prompt: 'Gezegenleri Güneş’e en yakından en uzağa doğru sırala. ☀️ → … → 🌍 → …',
    items: PLANETS,
    success: 'Doğru sıra: Merkür → Venüs → Dünya → Mars → Jüpiter → Satürn → Uranüs → Neptün 🎉',
  },
  {
    kind: 'choose',
    title: 'Mars’ı Keşfedelim',
    icon: { emoji: '🔴' },
    answer:
      'Mars, yüzeyindeki demir mineralleri nedeniyle kırmızımsı görünür. Bu yüzden ona **“Kızıl Gezegen”** de denir.\n\n**Bonus:** Mars’ta çok büyük volkanlar ve derin vadiler bulunur.',
    narration: 'Mars’a Kızıl Gezegen de denir. Mars hangi renkte görünür?',
    hint: '🔴 Mars’a iyi bak!',
    celebration: '🔴 Kızıl Gezegen!',
    prompt: 'Mars hangi renkte görünür?',
    options: [
      { label: 'Kırmızı', icon: '🔴', correct: true, feedback: '🔴 Evet, kırmızımsı!' },
      {
        label: 'Mavi',
        icon: '🔵',
        correct: false,
        feedback: '🔵 Mavi olan Dünya’ydı! Tekrar dene.',
      },
      { label: 'Yeşil', icon: '🟢', correct: false, feedback: '🟢 Mars’ta orman yok! 😄' },
    ],
    success: '🔴 Doğru! Demir mineralleri Mars’a kırmızı rengini verir.',
  },
  {
    kind: 'quiz',
    title: 'Satürn’ün Halkaları',
    icon: { emoji: '💍', custom: true },
    answer:
      'Satürn’ün çevresinde çok geniş **halkalar** bulunur. Bu halkalar çoğunlukla buz ve kaya parçalarından oluşur.',
    narration: 'Satürn’ün çevresinde çok geniş halkalar bulunur. Satürn’ü diğerlerinden ne ayırır?',
    hint: '🪐 Satürn’ün etrafına bak!',
    celebration: '💍 Halkalar yerinde!',
    question: 'Satürn’ü diğer gezegenlerden ayıran en belirgin özelliklerden biri nedir?',
    options: ['💍 Halkaları', '🌊 Okyanusları', '🌳 Ormanları'],
    correct: 0,
    explanation: 'Satürn’ün halkaları buz ve kaya parçalarından oluşur. 🪐',
  },
  {
    kind: 'choose',
    title: 'Roketler Nasıl Uçar?',
    icon: { emoji: '🚀' },
    answer:
      'Roketler, yakıtlarını yakarak oluşan gazları güçlü şekilde **aşağı doğru** püskürtür. Bu hareket roketin **yukarı doğru** ilerlemesini sağlar.',
    narration: 'Roketler gazları aşağı püskürtür ve yukarı çıkar. Roketi ne hareket ettirir?',
    hint: '🚀 3… 2… 1… Doğru cevaba dokun ve fırlat!',
    celebration: '🚀 Fırlatıldı!',
    prompt: 'Roketin uzaya doğru hareket etmesini sağlayan şey nedir?',
    options: [
      { label: 'İtme kuvveti', icon: '🚀', correct: true, feedback: '🚀 Evet, itme kuvveti!' },
      {
        label: 'Rüzgar',
        icon: '🌬️',
        correct: false,
        feedback: '🌬️ Uzayda rüzgar yok! Tekrar dene.',
      },
      { label: 'Yağmur', icon: '🌧️', correct: false, feedback: '🌧️ Yağmur roketi uçuramaz! 😄' },
    ],
    success: '3… 2… 1… 🚀 BOOM! İtme kuvveti roketi yukarı taşır. ⬆️',
  },
  {
    kind: 'quiz',
    title: 'Astronotlar Uzayda',
    icon: { emoji: '🧑‍🚀' },
    answer:
      'Astronotlar uzay görevlerinde özel giysiler kullanır: 🪖 kask, 👕 uzay giysisi, 🎒 yaşam destek ünitesi ve 👢 uzay botları. Bu giysiler onları uzayın **zorlu koşullarından** korur.',
    narration: 'Astronotlar kask, uzay giysisi, yaşam destek ünitesi ve uzay botları kullanır.',
    hint: '🧑‍🚀 Astronotun giysilerini düşün!',
    celebration: '🛡️ Güvendesin!',
    question: 'Astronotların özel kıyafet giymesinin nedenlerinden biri nedir?',
    options: ['🛡️ Onları korumak', '👗 Güzel görünmek', '🏃 Daha hızlı koşmak'],
    correct: 0,
    explanation: 'Uzay giysileri astronotları uzayın zorlu koşullarından korur.',
  },
  {
    kind: 'quiz',
    title: 'Uzayda Neden Ses Duyamayız?',
    icon: { emoji: '🌌' },
    answer:
      'Sesin yayılabilmesi için hava, su ya da başka bir madde gibi bir **ortama** ihtiyacı vardır. Uzayda ise çok büyük ölçüde **boşluk** bulunur.\n\n🔊 Ses → 🌬️ Hava → 👂 Kulak\n🔊 Ses → 🌌 Boş uzay ✖️',
    narration: 'Sesin yayılması için hava gibi bir ortam gerekir. Uzayda ise boşluk vardır.',
    hint: '🔊 Ses neyin içinde yol alır?',
    celebration: '🤫 Sessiz uzay!',
    question: 'Uzayda sesin yayılmasının zor olmasının temel nedeni nedir?',
    options: [
      '🌌 Ortamın büyük ölçüde boş olması',
      '☀️ Güneş’in sıcak olması',
      '🌍 Dünya’nın dönmesi',
    ],
    correct: 0,
    explanation: 'Ses, hava gibi bir ortam olmadan yayılamaz; uzay büyük ölçüde boştur.',
  },
  {
    kind: 'matching',
    title: 'Uzay Kâşifi Görevi',
    icon: { emoji: '🏆' },
    answer: 'Final keşfi! Tüm soruları doğru cevaplarsan artık bir **Uzay Kâşifi** olursun! 🚀',
    narration: 'Final görevi! Her soruyu doğru cevabıyla eşleştir.',
    hint: '👈 Soldan bir soru, sonra sağdan cevabını seç!',
    celebration: '🏆 Uzay Kâşifi!',
    prompt: 'Her soruyu doğru cevabıyla eşleştir.',
    pairs: [
      { left: 'Dünya hangi tür gök cismidir?', right: '🌍 Gezegen' },
      { left: 'Güneş nedir?', right: '☀️ Yıldız' },
      { left: 'Dünya’nın uydusu nedir?', right: '🌙 Ay' },
      { left: 'Mars hangi renkte görünür?', right: '🔴 Kırmızı' },
      { left: 'Satürn’ün belirgin özelliği?', right: '💍 Halkaları' },
    ],
    success: '🏆 Tebrikler! Artık bir Uzay Kâşifisin! 🚀',
  },
]
