import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  HiOutlineClock, HiOutlineChevronRight, HiOutlineUserCircle, HiOutlineChat, 
  HiOutlinePaperAirplane, HiOutlineSearch, HiOutlineFire, HiOutlineSparkles, HiOutlineTag
} from 'react-icons/hi';
import { 
  FaFacebookF, FaTwitter, FaWhatsapp, FaTelegramPlane, FaLink, FaYoutube, FaLinkedinIn, FaRedditAlien
} from 'react-icons/fa';

// 🚀 NAYA: YOUTUBE SUBSCRIBE WIDGET SCRIPT
const YoutubeSubscribeWidget = ({ channelName }) => {
  useEffect(() => {
    if (!window.gapi) {
      const script = document.createElement('script');
      script.src = "https://apis.google.com/js/platform.js";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.gapi && window.gapi.ytsubscribe) {
      window.gapi.ytsubscribe.go();
    }
  }, [channelName]);

  // Check if it's a Channel ID (Starts with UC and is 24 chars) or a Custom Name
  const isId = channelName && channelName.startsWith('UC') && channelName.length === 24;

  return (
    <div className="flex justify-center p-2">
      <div className="g-ytsubscribe" 
        {...(isId ? {'data-channelid': channelName} : {'data-channel': channelName})} 
        data-layout="full" 
        data-count="default">
      </div>
    </div>
  );
};

// TABBED WIDGET (Recent vs Popular)
const TabbedWidget = ({ recentPosts }) => {
  const [activeTab, setActiveTab] = useState('recent');
  const postsToShow = activeTab === 'recent' ? recentPosts.slice(0,4) : [...recentPosts].reverse().slice(0,4); 
  const formatDate = (timestamp) => timestamp ? timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "Just now";

  return (
    <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden">
      <div className="flex border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => setActiveTab('recent')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'recent' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}><HiOutlineSparkles size={14}/> Recent</button>
        <button onClick={() => setActiveTab('popular')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-l border-slate-100 dark:border-slate-800 ${activeTab === 'popular' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}><HiOutlineFire size={14}/> Popular</button>
      </div>
      <div className="p-5 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
        {postsToShow.map((post) => (
          <Link to={`/blogs/${post.slug}`} key={post.id} className="flex items-center gap-3 group">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700">
               {post.coverImage && <img src={post.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />}
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">{post.title}</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1"><HiOutlineClock size={10}/> {formatDate(post.createdAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const BlogDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [blog, setBlog] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarWidgets, setSidebarWidgets] = useState([]);

  useEffect(() => {
    const fetchBlogData = async () => {
      setIsLoading(true);
      try {
        window.scrollTo(0, 0);

        const q = query(collection(db, 'blogs'), where('slug', '==', slug));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) setBlog({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });

        const recentQ = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'), limit(8));
        const recentSnapshot = await getDocs(recentQ);
        const fetchedPosts = recentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(post => post.slug !== slug);
        
        setRelatedPosts(fetchedPosts.slice(0, 2));
        setRecentPosts(fetchedPosts); 

        const layoutDoc = await getDoc(doc(db, 'settings', 'sidebarLayout'));
        if (layoutDoc.exists() && layoutDoc.data().widgets) {
          setSidebarWidgets(layoutDoc.data().widgets);
        } else {
           setSidebarWidgets([{ type: 'search', id: '1' }, { type: 'tabs', id: '2'}]);
        }

      } catch (error) { console.error("Error:", error); } finally { setIsLoading(false); }
    };
    fetchBlogData();
  }, [slug]);

  if (isLoading) return <div className="min-h-screen pt-32 pb-24 flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!blog) return <div className="min-h-screen pt-32 text-center text-2xl font-black">Article Not Found</div>;

  const formatDate = (timestamp) => timestamp ? timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "Just now";
  const currentUrl = window.location.href;
  const shareText = `Check out: ${blog.title}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    alert("Article link copied to clipboard! 🚀");
  };

  return (
    <div className="bg-[#f8fafc] dark:bg-[#020617] min-h-screen pt-24 pb-24 font-sans animate-in fade-in duration-700">
      
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 mb-8"><div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900/50 inline-flex px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"><button onClick={() => navigate('/')} className="hover:text-blue-600">Home</button> <HiOutlineChevronRight size={14} /><button onClick={() => navigate('/blogs')} className="hover:text-blue-600">Blogs</button> <HiOutlineChevronRight size={14} /><span className="text-blue-600 truncate max-w-[150px]">{blog.category}</span></div></div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* ================= LEFT: MAIN ARTICLE ================= */}
          <div className="w-full lg:w-[68%]">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 mb-10">
              <div className="p-6 md:p-10 border-b border-slate-100 dark:border-slate-800">
                <div className="inline-block bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 mb-6 rounded-lg">{blog.category}</div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight mb-8">{blog.title}</h1>
                {blog.coverImage && <div className="w-full aspect-[16/9] mb-10 overflow-hidden rounded-[1.5rem] shadow-lg border border-slate-100 dark:border-slate-800"><img src={blog.coverImage} className="w-full h-full object-cover" /></div>}
                <div className="prose prose-lg dark:prose-invert max-w-none prose-img:rounded-[1.5rem] prose-a:text-blue-500" dangerouslySetInnerHTML={{ __html: blog.content }} />
              </div>
              
              <div className="px-6 md:px-10 py-6 bg-slate-50 dark:bg-slate-800/30 flex flex-col md:flex-row items-start md:items-center gap-4">
                <span className="text-sm font-black uppercase text-slate-900 dark:text-white">Share:</span>
                <div className="flex flex-wrap gap-2">
                  <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + currentUrl)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all"><FaWhatsapp size={18}/></a>
                  <a href={`https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc] hover:text-white transition-all"><FaTelegramPlane size={18}/></a>
                  <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-black hover:text-white transition-all"><FaTwitter size={18}/></a>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2] hover:text-white transition-all"><FaFacebookF size={16}/></a>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5] hover:text-white transition-all"><FaLinkedinIn size={16}/></a>
                  <a href={`https://reddit.com/submit?url=${encodeURIComponent(currentUrl)}&title=${encodeURIComponent(blog.title)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#ff4500]/10 text-[#ff4500] hover:bg-[#ff4500] hover:text-white transition-all"><FaRedditAlien size={18}/></a>
                  <button onClick={handleCopyLink} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white transition-all"><FaLink size={16}/></button>
                </div>
              </div>
            </div>

            {relatedPosts.length > 0 && (
              <div className="mb-10">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 border-l-4 border-blue-600 pl-4">You May Also Like</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {relatedPosts.map(post => (
                    <Link to={`/blogs/${post.slug}`} key={post.id} className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group hover:-translate-y-1 transition-all">
                      <div className="w-full aspect-[16/9] bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                        <div className="absolute top-3 left-3 bg-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md z-10 text-slate-900">{post.category}</div>
                        {post.coverImage && <img src={post.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                      </div>
                      <div className="p-5">
                        <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">{post.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(post.createdAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
              <div className="p-6 md:p-8">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3"><HiOutlineChat className="text-blue-500" size={24} /> Discussion (0)</h3>
                <div className="flex items-start gap-4 mb-8">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><HiOutlineUserCircle size={24} /></div>
                  <div className="flex-1 relative">
                    <textarea rows="3" placeholder={user ? "Share your thoughts..." : "Log in to comment."} disabled={!user} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl outline-none font-medium disabled:opacity-50"></textarea>
                    <button disabled={!user} className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md"><HiOutlinePaperAirplane size={16} className="rotate-90" /></button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT: DYNAMIC WIDGET RENDERER ================= */}
          <div className="w-full lg:w-[32%] space-y-6 lg:sticky lg:top-24 pb-10">
            {sidebarWidgets.map((widget) => {
              
              if (widget.type === 'search') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-1 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] flex items-center">
                  <input type="text" placeholder="Search this blog..." className="w-full bg-transparent px-4 py-3 text-sm font-medium outline-none text-slate-900 dark:text-white" />
                  <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 mr-1"><HiOutlineSearch size={18}/></button>
                </div>
              );

              if (widget.type === 'about') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] text-center">
                  <div className="w-24 h-24 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4 border-2 border-blue-100"><img src={widget.image || "https://ui-avatars.com/api/?name=Author&background=0D8ABC&color=fff"} className="w-full h-full object-cover" /></div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">{widget.name || 'Admin'}</h4>
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3">{widget.role}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{widget.bio}</p>
                </div>
              );

              // 🚀🚀 MISSING CODE ADDED HERE: FACEBOOK WIDGET RENDERER 🚀🚀
              if (widget.type === 'facebook') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden flex flex-col items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 text-slate-900 dark:text-white w-full text-center flex items-center justify-center gap-2"><FaFacebookF className="text-[#1877F2]"/> {widget.title || 'FB Likes'}</h3>
                  <iframe 
                    src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(widget.fbUrl || 'https://www.facebook.com/facebook')}&tabs=&width=300&height=130&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`} 
                    width="100%" height="130" style={{border:'none', overflow:'hidden'}} scrolling="no" frameBorder="0" allowFullScreen={true} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  ></iframe>
                </div>
              );

              // 🚀🚀 MISSING CODE ADDED HERE: YOUTUBE WIDGET RENDERER 🚀🚀
              if (widget.type === 'youtube') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] flex flex-col items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 text-slate-900 dark:text-white w-full text-center flex items-center justify-center gap-2"><FaYoutube className="text-[#FF0000]"/> {widget.title || 'YT Subscribe'}</h3>
                  <YoutubeSubscribeWidget channelName={widget.channelName || 'Google'} />
                </div>
              );

              if (widget.type === 'telegram') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] text-center overflow-hidden">
                  <h3 className="text-xs font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 text-slate-900 dark:text-white flex items-center justify-center gap-2"><FaTelegramPlane className="text-[#0088cc]"/> {widget.title || 'Live Updates'}</h3>
                  <div className="w-full h-[400px] rounded-xl overflow-hidden relative bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-inner">
                    <iframe 
                      src={`https://t.me/s/${widget.channel || 'bpcryptocraft'}?embed=1`}
                      className="w-full h-full absolute inset-0"
                      frameBorder="0"
                      scrolling="yes"
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    ></iframe>
                  </div>
                </div>
              );

              if (widget.type === 'html') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem] text-center overflow-hidden">
                  {widget.title && <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">{widget.title}</span>}
                  <div dangerouslySetInnerHTML={{ __html: widget.content }} className="w-full max-w-full overflow-x-hidden flex flex-col items-center" />
                </div>
              );

              if (widget.type === 'social') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem]">
                  <h3 className="text-xs font-black uppercase tracking-widest border-l-4 border-blue-600 pl-3 mb-6 text-slate-900 dark:text-white">{widget.title}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {widget.fb && <a href={widget.fb} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-[#1877F2]/10 text-[#1877F2] rounded-xl font-bold text-[11px] uppercase"><FaFacebookF/> FB</a>}
                    {widget.yt && <a href={widget.yt} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-[#FF0000]/10 text-[#FF0000] rounded-xl font-bold text-[11px] uppercase"><FaYoutube/> YouTube</a>}
                    {widget.telegram && <a href={widget.telegram} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-[#0088cc]/10 text-[#0088cc] rounded-xl font-bold text-[11px] uppercase"><FaTelegramPlane/> Telegram</a>}
                    {widget.linkedin && <a href={widget.linkedin} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-[#0077b5]/10 text-[#0077b5] rounded-xl font-bold text-[11px] uppercase"><FaLinkedinIn/> LinkedIn</a>}
                  </div>
                </div>
              );

              if (widget.type === 'tabs') return (
                <TabbedWidget key={widget.id} recentPosts={recentPosts} />
              );

              if (widget.type === 'tags') return (
                <div key={widget.id} className="bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[1.5rem]">
                  <h3 className="text-xs font-black uppercase tracking-widest border-l-4 border-blue-600 pl-3 mb-6 text-slate-900 dark:text-white">{widget.title}</h3>
                  <div className="flex flex-wrap gap-2">{["Crypto", "Earning", "Tech", "Trading", "Finance"].map((label, idx) => <span key={idx} className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">{label}</span>)}</div>
                </div>
              );

              if (widget.type === 'newsletter') return (
                <div key={widget.id} className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 shadow-lg rounded-[1.5rem] text-white text-center">
                  <h3 className="text-lg font-black mb-2">{widget.title}</h3>
                  <p className="text-xs text-blue-100 mb-4">Get crypto tips directly in your inbox.</p>
                  <input type="email" placeholder="Email Address" className="w-full px-4 py-3 rounded-xl text-slate-900 text-sm outline-none mb-3" />
                  <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800">Subscribe</button>
                </div>
              );

              return null;
            })}
            
            {sidebarWidgets.length === 0 && <div className="text-center p-6 text-slate-500 text-xs font-bold uppercase border-2 border-dashed border-slate-200 rounded-2xl">No Widgets Configured</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogDetail;