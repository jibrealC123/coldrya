export const outfitDatabase = {
  casual: {
    male: [
      {
        id: 1,
        name: "Classic Street Look",
        items: [
          {
            type: "Top",
            name: "Oversized White Tee",
            brand: "H&M",
            price: 14.99,
            image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop",
            link: "https://www2.hm.com/en_us/men/products/t-shirts-tanks.html",
          },
          {
            type: "Bottom",
            name: "Slim Fit Jeans",
            brand: "Levi's",
            price: 59.99,
            image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=300&fit=crop",
            link: "https://www.levi.com/US/en_US/clothing/men/jeans/c/levi_clothing_men_jeans",
          },
          {
            type: "Shoes",
            name: "White Sneakers",
            brand: "Nike",
            price: 89.99,
            image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop",
            link: "https://www.nike.com/w/mens-lifestyle-shoes-13jrmznik1zy7ok",
          },
        ],
        tags: ["trending", "minimalist", "everyday"],
        totalPrice: 164.97,
      },
      {
        id: 2,
        name: "Streetwear Flex",
        items: [
          {
            type: "Top",
            name: "Graphic Hoodie",
            brand: "Champion",
            price: 55.0,
            image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=300&h=300&fit=crop",
            link: "https://www.amazon.com/s?k=graphic+hoodie+champion",
          },
          {
            type: "Bottom",
            name: "Cargo Pants",
            brand: "Zara",
            price: 49.99,
            image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&h=300&fit=crop",
            link: "https://www.zara.com/us/en/man-trousers-l1305.html",
          },
          {
            type: "Shoes",
            name: "Air Jordan 1",
            brand: "Nike",
            price: 170.0,
            image: "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=300&h=300&fit=crop",
            link: "https://www.nike.com/w/air-jordan-1-shoes-3pqoaznik1",
          },
        ],
        tags: ["streetwear", "bold", "popular"],
        totalPrice: 274.99,
      },
    ],
    female: [
      {
        id: 3,
        name: "Chic Casual Vibes",
        items: [
          {
            type: "Top",
            name: "Cropped Knit Sweater",
            brand: "ASOS",
            price: 32.0,
            image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=300&h=300&fit=crop",
            link: "https://www.asos.com/women/jumpers-cardigans/cat/?cid=2637",
          },
          {
            type: "Bottom",
            name: "High-Waist Wide Leg Pants",
            brand: "Zara",
            price: 45.99,
            image: "https://images.unsplash.com/photo-1594938298603-c8148c4b4afe?w=300&h=300&fit=crop",
            link: "https://www.zara.com/us/en/woman-trousers-l1049.html",
          },
          {
            type: "Shoes",
            name: "Platform Sneakers",
            brand: "New Balance",
            price: 99.99,
            image: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=300&h=300&fit=crop",
            link: "https://www.newbalance.com/women-shoes/",
          },
        ],
        tags: ["trending", "cozy", "everyday"],
        totalPrice: 177.98,
      },
      {
        id: 4,
        name: "Y2K Aesthetic",
        items: [
          {
            type: "Top",
            name: "Baby Tee",
            brand: "Urban Outfitters",
            price: 28.0,
            image: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=300&h=300&fit=crop",
            link: "https://www.urbanoutfitters.com/womens-tops",
          },
          {
            type: "Bottom",
            name: "Low-Rise Mini Skirt",
            brand: "H&M",
            price: 22.99,
            image: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300&h=300&fit=crop",
            link: "https://www2.hm.com/en_us/women/products/skirts.html",
          },
          {
            type: "Shoes",
            name: "Platform Boots",
            brand: "Steve Madden",
            price: 119.95,
            image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300&h=300&fit=crop",
            link: "https://www.stevemadden.com/collections/womens-boots",
          },
        ],
        tags: ["y2k", "bold", "trendy"],
        totalPrice: 170.94,
      },
    ],
  },
  formal: {
    male: [
      {
        id: 5,
        name: "Sharp Business Casual",
        items: [
          {
            type: "Top",
            name: "Oxford Button-Down",
            brand: "Ralph Lauren",
            price: 89.5,
            image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=300&fit=crop",
            link: "https://www.ralphlauren.com/men-shirts-dress-shirts",
          },
          {
            type: "Bottom",
            name: "Slim Chinos",
            brand: "Banana Republic",
            price: 79.99,
            image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300&h=300&fit=crop",
            link: "https://bananarepublic.gap.com/browse/category.do?cid=5082",
          },
          {
            type: "Shoes",
            name: "Leather Derby Shoes",
            brand: "Clarks",
            price: 110.0,
            image: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=300&h=300&fit=crop",
            link: "https://www.clarksusa.com/mens-dress-shoes/",
          },
        ],
        tags: ["office", "professional", "clean"],
        totalPrice: 279.49,
      },
    ],
    female: [
      {
        id: 6,
        name: "Power Suit Moment",
        items: [
          {
            type: "Top",
            name: "Tailored Blazer",
            brand: "Zara",
            price: 79.99,
            image: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&h=300&fit=crop",
            link: "https://www.zara.com/us/en/woman-blazers-l2452.html",
          },
          {
            type: "Bottom",
            name: "Straight Leg Trousers",
            brand: "& Other Stories",
            price: 69.0,
            image: "https://images.unsplash.com/photo-1594938298603-c8148c4b4afe?w=300&h=300&fit=crop",
            link: "https://www.stories.com/en_usd/clothing/trousers.html",
          },
          {
            type: "Shoes",
            name: "Block Heel Pumps",
            brand: "Sam Edelman",
            price: 89.95,
            image: "https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=300&h=300&fit=crop",
            link: "https://www.samedelman.com/collections/pumps",
          },
        ],
        tags: ["office", "powerful", "chic"],
        totalPrice: 238.94,
      },
    ],
  },
  athletic: {
    male: [
      {
        id: 7,
        name: "Gym Ready",
        items: [
          {
            type: "Top",
            name: "Dry-Fit Training Tee",
            brand: "Nike",
            price: 35.0,
            image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=300&h=300&fit=crop",
            link: "https://www.nike.com/w/mens-training-tops-shirts-3n5r9z6ymx6znik1",
          },
          {
            type: "Bottom",
            name: "Jogger Shorts",
            brand: "Adidas",
            price: 30.0,
            image: "https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=300&h=300&fit=crop",
            link: "https://www.adidas.com/us/men-shorts",
          },
          {
            type: "Shoes",
            name: "Training Shoes",
            brand: "Adidas",
            price: 85.0,
            image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=300&h=300&fit=crop",
            link: "https://www.adidas.com/us/training-shoes",
          },
        ],
        tags: ["gym", "performance", "comfort"],
        totalPrice: 150.0,
      },
    ],
    female: [
      {
        id: 8,
        name: "Athleisure Queen",
        items: [
          {
            type: "Top",
            name: "Seamless Sports Bra",
            brand: "Lululemon",
            price: 58.0,
            image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop",
            link: "https://www.lululemon.com/en-us/c/womens-sports-bras",
          },
          {
            type: "Bottom",
            name: "High-Rise Leggings",
            brand: "Lululemon",
            price: 98.0,
            image: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=300&h=300&fit=crop",
            link: "https://www.lululemon.com/en-us/c/womens-leggings",
          },
          {
            type: "Shoes",
            name: "Running Shoes",
            brand: "HOKA",
            price: 140.0,
            image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop",
            link: "https://www.hoka.com/en/us/womens-road/",
          },
        ],
        tags: ["gym", "athleisure", "comfort"],
        totalPrice: 296.0,
      },
    ],
  },
};

export function getOutfits(style, gender, budget) {
  const genderKey = gender === "male" ? "male" : "female";
  const styleOutfits = outfitDatabase[style]?.[genderKey] || [];
  return styleOutfits.filter((o) => o.totalPrice <= budget);
}
