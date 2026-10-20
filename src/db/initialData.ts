import { DatabaseSchema } from "../types";

export const initialDbData: DatabaseSchema = {
  users: {
    "u_1": {
      id: "u_1",
      name: "Sarah Jenkins",
      username: "sarahj",
      email: "sarah@example.com",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      bio: "Dog lover, avid park runner and pet photographer 📸🐕",
      role: "user",
      status: "active",
      subscriptionPlan: "free",
      animals: ["1"],
      createdAt: "2024-01-10T10:00:00.000Z"
    },
    "u_2": {
      id: "u_2",
      name: "Alex Rivera",
      username: "arivera",
      email: "alex@example.com",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      bio: "Feline enthusiast & pet nutritionist 🐈✨",
      role: "business",
      status: "active",
      subscriptionPlan: "basic",
      animals: ["2"],
      createdAt: "2024-02-15T12:00:00.000Z"
    },
    "u_3": {
      id: "u_3",
      name: "Clemence",
      username: "clemence",
      email: "clemence@example.com",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      bio: "Proud handler of Bella the Fetch Champion! 🎾",
      role: "user",
      status: "active",
      subscriptionPlan: "free",
      animals: ["bella"],
      createdAt: "2024-03-01T08:00:00.000Z"
    }
  },
  animals: {
    "1": {
      id: "1",
      name: "Bailey",
      username: "@bailey.thelab",
      avatar: "🐕",
      coverImage: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=800&auto=format&fit=crop&q=80",
      breed: "Golden Retriever",
      age: "2 yrs",
      location: "Austin, TX",
      bio: "Obsessed with tennis balls & park swims. 🎾🐕",
      handlerId: "u_1",
      handlerName: "Sarah Jenkins",
      followersCount: 45200,
      followingCount: 120,
      photos: [
        "https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=500&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500&auto=format&fit=crop&q=80"
      ],
      isVerified: true,
      createdAt: "2024-01-10T10:30:00.000Z"
    },
    "2": {
      id: "2",
      name: "Luna",
      username: "@luna.cat",
      avatar: "🐈",
      coverImage: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80",
      breed: "Siamese Mix",
      age: "3 yrs",
      location: "Seattle, WA",
      bio: "Queen of cardboard boxes and sunbeams 👑🐈",
      handlerId: "u_2",
      handlerName: "Alex Rivera",
      followersCount: 89100,
      followingCount: 45,
      photos: [
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=500&auto=format&fit=crop&q=80"
      ],
      isVerified: true,
      createdAt: "2024-02-15T12:30:00.000Z"
    },
    "bella": {
      id: "bella",
      name: "Bella",
      username: "@bella.lab",
      avatar: "🐕",
      coverImage: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&auto=format&fit=crop&q=80",
      breed: "Labrador Retriever",
      age: "3 yrs",
      location: "Denver, CO",
      bio: "Living my best life 🐾 Fetch champion 2024",
      handlerId: "u_3",
      handlerName: "Clemence",
      followersCount: 1250,
      followingCount: 88,
      photos: [
        "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500&auto=format&fit=crop&q=80"
      ],
      isVerified: false,
      createdAt: "2024-03-01T08:30:00.000Z"
    }
  },
  follows: {
    "u_1_2": true,
    "u_3_1": true
  },
  posts: {
    "post_1": {
      id: "post_1",
      animalId: "1",
      animalName: "Bailey",
      animalAvatar: "🐕",
      animalUsername: "@bailey.thelab",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      imageUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=800&auto=format&fit=crop&q=80",
      caption: "Mastering the double backflip fetch! 🎾🐶 #DogLife #GoldenRetriever #SuperPup",
      likesCount: 12400,
      commentsCount: 342,
      sharesCount: 156,
      tags: ["DogLife", "GoldenRetriever", "SuperPup"],
      createdAt: "2024-09-01T14:00:00.000Z"
    },
    "post_2": {
      id: "post_2",
      animalId: "2",
      animalName: "Luna",
      animalAvatar: "🐈",
      animalUsername: "@luna.cat",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      imageUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80",
      caption: "Fits if I sits! Defeated the giant Amazon box today 📦✨ #CatLife #LunaTheQueen",
      likesCount: 28900,
      commentsCount: 512,
      sharesCount: 890,
      tags: ["CatLife", "LunaTheQueen", "FunnyCats"],
      createdAt: "2024-09-02T16:30:00.000Z"
    },
    "post_3": {
      id: "post_3",
      animalId: "bella",
      animalName: "Bella",
      animalAvatar: "🐕",
      animalUsername: "@bella.lab",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      imageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&auto=format&fit=crop&q=80",
      caption: "Morning lake sprint with my favorite stick! 🌊🐾 #Labrador #FetchChamp",
      likesCount: 840,
      commentsCount: 29,
      sharesCount: 12,
      tags: ["Labrador", "FetchChamp", "DogPark"],
      createdAt: "2024-09-05T09:15:00.000Z"
    }
  },
  likes: {
    "u_3_post_1": true
  },
  comments: {
    "post_1": [
      {
        id: "c_1",
        postId: "post_1",
        user: "@luna.cat",
        avatar: "🐈",
        text: "Impression 10/10! Dogs are so dramatic 😹",
        createdAt: "2024-09-01T14:30:00.000Z"
      },
      {
        id: "c_2",
        postId: "post_1",
        user: "@bella.lab",
        avatar: "🐕",
        text: "Let's play fetch together at Central Park! 🎾",
        createdAt: "2024-09-01T15:00:00.000Z"
      }
    ]
  },
  products: {
    "prod_1": {
      id: "prod_1",
      title: "Interactive Smart Laser Cat Toy",
      price: 29.99,
      currency: "$",
      category: "Toys",
      image: "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=500&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviewsCount: 128,
      description: "Automated 360 degree rotating laser toy that keeps cats entertained for hours. Has automatic shutoff timer.",
      sellerId: "u_2",
      sellerName: "Alex Rivera",
      sellerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      inStock: true,
      approvalStatus: "approved",
      tags: ["Cats", "Toys", "Interactive"]
    },
    "prod_2": {
      id: "prod_2",
      title: "Ergonomic Padded Dog Harness",
      price: 34.50,
      currency: "$",
      category: "Accessories",
      image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=500&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 210,
      description: "No-choke reflective harness with dual leash attachment points for ultimate control and comfort during walks.",
      sellerId: "u_1",
      sellerName: "Sarah Jenkins",
      sellerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      inStock: true,
      approvalStatus: "approved",
      tags: ["Dogs", "Harness", "Walking"]
    },
    "prod_3": {
      id: "prod_3",
      title: "Organic Salmon Oil Skin & Coat Supplement",
      price: 22.00,
      currency: "$",
      category: "Health & Care",
      image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80",
      rating: 4.7,
      reviewsCount: 85,
      description: "Pure Norwegian salmon oil rich in Omega-3 fatty acids for shiny coat, healthy skin, and joint support.",
      sellerId: "u_2",
      sellerName: "Alex Rivera",
      sellerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      inStock: true,
      approvalStatus: "pending",
      tags: ["Supplement", "Nutrition", "Health"]
    }
  },
  services: {
    "serv_1": {
      id: "serv_1",
      title: "Mobile Full Dog Grooming Spa",
      providerName: "Pawsome Groomers Co.",
      providerAvatar: "🧼",
      category: "Grooming",
      rating: 4.9,
      reviewsCount: 94,
      price: "$75 / session",
      image: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=500&auto=format&fit=crop&q=80",
      description: "We bring our state-of-the-art van to your doorstep! Includes bath, blow dry, nail trim, haircut, and ear cleaning.",
      location: "Austin & surrounding areas",
      contactEmail: "grooming@pawsome.com",
      approvalStatus: "approved"
    },
    "serv_2": {
      id: "serv_2",
      title: "Positive Reinforcement Puppy Training",
      providerName: "K9 Academy Austin",
      providerAvatar: "🎓",
      category: "Training",
      rating: 5.0,
      reviewsCount: 140,
      price: "$120 / week",
      image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&auto=format&fit=crop&q=80",
      description: "Certified trainers focused on positive reinforcement, basic obedience, leash manners, and puppy socialization.",
      location: "Central Park, Austin, TX",
      contactEmail: "info@k9academytx.com",
      approvalStatus: "pending"
    }
  },
  events: {
    "ev_1": {
      id: "ev_1",
      title: "Annual Golden Retriever Water Dash",
      date: "Oct 15, 2026",
      time: "10:00 AM - 2:00 PM",
      location: "Lady Bird Lake Park, Austin, TX",
      image: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=600&auto=format&fit=crop&q=80",
      attendeesCount: 142,
      category: "Meetup",
      description: "Join hundreds of dog owners for a fun-filled day of lake swimming, fetch contests, and pet costume parade!",
      organizerName: "Austin Paws Club",
      isAttending: true
    },
    "ev_2": {
      id: "ev_2",
      title: "Cat Agility & Obstacle Showcase",
      date: "Nov 02, 2026",
      time: "1:00 PM - 5:00 PM",
      location: "Seattle Expo Center, WA",
      image: "https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=600&auto=format&fit=crop&q=80",
      attendeesCount: 88,
      category: "Competition",
      description: "Watch talented feline athletes navigate tunnel mazes, high jumps, and agility courses!",
      organizerName: "Pacific Northwest Feline League",
      isAttending: false
    }
  },
  notifications: {
    "u_3": [
      {
        id: "n_1",
        userId: "u_3",
        type: "event",
        title: "Dog Park Meetup Reminder",
        message: "Golden Retriever Water Dash starts in 1 hour near Lady Bird Lake!",
        timestamp: "10m ago",
        read: false
      }
    ]
  },
  messages: {
    "thread_1": [
      {
        id: "m_1",
        threadId: "thread_1",
        senderId: "u_1",
        senderName: "Sarah Jenkins",
        senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        text: "Hey Clemence! Is Bella coming to the dog park meetup this weekend?",
        timestamp: "Yesterday 4:15 PM"
      }
    ]
  },
  reports: {
    "rep_1": {
      id: "rep_1",
      targetType: "post",
      targetId: "post_1",
      targetTitle: "Mastering the double backflip fetch! 🎾🐶",
      reason: "Dangerous stunt attempt / Animal safety concern",
      reporterName: "@arivera",
      status: "pending",
      createdAt: "2026-09-07T18:00:00.000Z"
    },
    "rep_2": {
      id: "rep_2",
      targetType: "product",
      targetId: "prod_3",
      targetTitle: "Organic Salmon Oil Skin & Coat Supplement",
      reason: "Unverified health claims in product description",
      reporterName: "@sarahj",
      status: "pending",
      createdAt: "2026-09-07T18:30:00.000Z"
    }
  },
  auditLogs: [
    {
      id: "log_1",
      adminName: "System Admin",
      action: "Verified Pet Profile",
      details: "Granted verification badge to @bailey.thelab",
      timestamp: "Today 19:40"
    },
    {
      id: "log_2",
      adminName: "System Admin",
      action: "Verified Pet Profile",
      details: "Granted verification badge to @luna.cat",
      timestamp: "Today 19:45"
    }
  ]
};
