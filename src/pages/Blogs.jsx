import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { HiOutlineArrowRight, HiOutlineClock, HiOutlineTag } from 'react-icons/hi';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
// Same categories as your Admin Panel
const categories = ["All", "Tech & AI", "Crypto Strategies", "Wealth Management", "Platform Updates", "News"];

const Blogs = () => {
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // 🚀 Fetch all blogs from Firebase when page loads
  useEffect(() => {
    const fetchBlogs = async () => {
      setIsLoading(true);
      try {
        // Fetch blogs ordered by newest first
        const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedBlogs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setBlogs(fetchedBlogs);
      } catch (error) {
        console.error("Error fetching blogs: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  // 🚀 Dynamic Filtering based on selected category
  const filteredBlogs = activeCategory === "All" 
    ? blogs 
    : blogs.filter(blog => blog.category === activeCategory);

  // Smart Layout Logic: Top post is Featured, rest go to Grid
  const featuredPost = filteredBlogs[0]; 
  const gridPosts = filteredBlogs.slice(1);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if(!email) return;
    
    try {
      // 1. Pehle Firebase mein email save karo (Backup ke liye)
      await addDoc(collection(db, 'subscribers'), {
        email: email,
        subscribedAt: serverTimestamp()
      });

      // 2. Ab user ko EmailJS ke through Welcome Email bhejo
      const templateParams = {
        user_email: email, // Yeh email sidha aapke template ke {{user_email}} mein jayega
        // Agar aapne template mein {{message}} ya kuch aur lagaya hai, toh wo bhi yahan pass kar sakte hain
      };

      await emailjs.send(
        'YOUR_SERVICE_ID',   // 👈 EmailJS se copy kiya hua Service ID yahan dalein
        'YOUR_TEMPLATE_ID',  // 👈 EmailJS se copy kiya hua Template ID yahan dalein
        templateParams,
        'YOUR_PUBLIC_KEY'    // 👈 EmailJS se copy kiya hua Public Key yahan dalein
      );

      // 3. UI Update karo
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 3000);
      
    } catch (error) {
      console.error("Error subscribing: ", error);
    }
  };
  // Helper: Format Firebase Timestamp to Date string
  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper: Calculate Read Time based on content length (avg 200 words per minute)
  const calculateReadTime = (htmlContent) => {
    if (!htmlContent) return "3 min";
    const text = htmlContent.replace(/<[^>]+>/g, ''); // Strip HTML tags
    const wordCount = text.split(/\s+/).length;
    const time = Math.ceil(wordCount / 200);
    return `${time === 0 ? 1 : time} min read`;
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* 1. HEADER SECTION & CATEGORIES */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter">
              Our <span className="text-blue-600">Insights</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md">
              Exploring the intersection of wealth management, crypto strategies, and high-performance AI.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeCategory === cat 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                    : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-blue-600 border border-slate-200 dark:border-slate-800 shadow-sm'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-32 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Fetching latest articles...</p>
          </div>
        )}

        {/* Fallback if no posts in category */}
        {!isLoading && filteredBlogs.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
            <p className="text-slate-400 font-bold">No articles found in this category.</p>
          </div>
        )}

        {/* 2. FEATURED POST (Dynamic Top Post) */}
        {!isLoading && featuredPost && (
          <Link to={`/blogs/${featuredPost.slug}`} className="relative group cursor-pointer block">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-25 transition-opacity duration-500" />
            <div className="relative p-6 md:p-12 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col-reverse md:flex-row gap-8 items-center overflow-hidden shadow-sm">
              <div className="flex-1 space-y-4 w-full">
                <div className="flex items-center gap-3 text-blue-600 text-[10px] font-black uppercase tracking-widest">
                  <HiOutlineTag /> {featuredPost.category} • Featured
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-3 md:line-clamp-none">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-1"><HiOutlineClock size={14}/> {calculateReadTime(featuredPost.content)}</span>
                  <span>•</span>
                  <span>{formatDate(featuredPost.createdAt)}</span>
                </div>
              </div>
              <div className="w-full md:w-1/2 aspect-video md:aspect-square rounded-[2rem] overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                {featuredPost.coverImage ? (
                  <img src={featuredPost.coverImage} alt={featuredPost.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 font-black text-2xl uppercase tracking-widest">Finledger</div>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* 3. BLOG GRID (Rest of the posts) */}
        {!isLoading && gridPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridPosts.map(post => (
              <Link to={`/blogs/${post.slug}`} key={post.id} className="group p-4 sm:p-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col">
                <div className="aspect-video rounded-3xl bg-slate-100 dark:bg-slate-800 mb-6 overflow-hidden relative">
                   {post.coverImage ? (
                     <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                   ) : (
                     <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest">Finledger</div>
                   )}
                </div>
                <div className="space-y-3 flex-1 flex flex-col">
                  <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                    {post.category}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium line-clamp-2 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between pt-4 mt-auto">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-400">
                        {post.author ? post.author.charAt(0) : 'A'}
                      </div>
                      <span className="truncate max-w-[100px]">{post.author || 'Admin'}</span>
                    </div>
                    <button className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <HiOutlineArrowRight />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 4. NEWSLETTER CTA */}
        <div className="p-8 md:p-12 rounded-[3rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden mt-12 border border-blue-500/50">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
          
          <div className="relative z-10">
            <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Stay ahead of the market.</h3>
            <p className="text-blue-100 font-medium max-w-md mx-auto">Get the latest crypto insights and platform updates delivered straight to your inbox.</p>
          </div>
          
          <form onSubmit={handleSubscribe} className="relative z-10 w-full max-w-md flex flex-col sm:flex-row gap-3 mt-4">
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address" 
              className="flex-1 px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 outline-none focus:bg-white/20 focus:border-white/40 transition-all text-sm font-bold shadow-inner" 
            />
            <button type="submit" className="px-8 py-4 rounded-2xl bg-white text-blue-600 font-black text-sm uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2">
              {isSubscribed ? 'Subscribed!' : 'Join Now'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Blogs;