import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  HelpCircle, Timer, ChevronLeft, ChevronRight, CheckCircle2, XCircle, 
  Play, RotateCcw, Eye, EyeOff, Plus, Trash2, Settings, 
  Image as ImageIcon, Video, Volume2, Box, Beaker, 
  Check, X, GripVertical, Save, Edit3, Layout, Upload, Link as LinkIcon,
  FileText, FlipHorizontal, Award, Clock
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../utils/db';

import { MermaidDiagram } from './MermaidDiagram';
import { SmilesDiagram } from './SmilesDiagram';
import { InteractivePlot } from './InteractivePlot';
import { ModelViewerEngine } from './ModelViewerEngine';
import { PhysicsSimulation } from './PhysicsSimulation';

type QuestionType = 'multiple-choice' | 'matching' | 'fill-in-the-blanks' | 'short-answer';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio' | 'model' | 'smiles';
  url?: string;
  content?: string;
  blobId?: string;
}

interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: any;
  pairs?: { id: string; left: string; right: string }[];
  explanation?: string;
  points: number;
  media?: MediaItem[];
}

interface QuizConfig {
  internal_block_id?: string;
  title: string;
  description?: string;
  duration: number; // minutes
  questions: Question[];
}

interface QuizEngineProps {
  configStr: string;
  onUpdate: (newStr: string) => void;
  readOnly?: boolean;
}

export const QuizEngine: React.FC<QuizEngineProps> = ({ configStr, onUpdate, readOnly }) => {
  const [config, setConfig] = useState<QuizConfig>(() => {
    try {
      const parsed = JSON.parse(configStr);
      return {
        title: parsed.title || 'Untitled Quiz',
        description: parsed.description || '',
        duration: parsed.duration || 30,
        questions: parsed.questions || [],
        internal_block_id: parsed.internal_block_id
      };
    } catch (e) {
      return { title: 'New Quiz', duration: 30, questions: [] };
    }
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [isExamSubmitted, setIsExamSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.duration * 60);
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

  // Modal state for replacing prompt()
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    value: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    value: '',
    onConfirm: () => {},
  });

  const openModal = (title: string, placeholder: string, onConfirm: (val: string) => void) => {
    setModal({ isOpen: true, title, placeholder, value: '', onConfirm });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false, value: '' }));
  };

  // Load blob URLs
  useEffect(() => {
    const loadBlobs = async () => {
      const urls: Record<string, string> = {};
      for (const q of config.questions) {
        if (q.media) {
          for (const m of q.media) {
            if (m.blobId) {
              const blobRecord = await db.blobs.get(m.blobId);
              if (blobRecord) {
                urls[m.blobId] = URL.createObjectURL(blobRecord.data);
              }
            }
          }
        }
      }
      setBlobUrls(urls);
    };
    loadBlobs();
    return () => {
      Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [config.questions]);

  // Sync config from props
  useEffect(() => {
    try {
      const parsed = JSON.parse(configStr);
      const newConfig = {
        title: parsed.title || 'Untitled Quiz',
        description: parsed.description || '',
        duration: parsed.duration || 30,
        questions: parsed.questions || [],
        internal_block_id: parsed.internal_block_id
      };
      // Only update if actually different to avoid loops
      if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
        setConfig(newConfig);
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  }, [configStr]);

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (isExamStarted && !isExamSubmitted && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isExamStarted && !isExamSubmitted) {
      submitExam();
    }
    return () => clearInterval(timer);
  }, [isExamStarted, isExamSubmitted, timeLeft]);

  const handleUpdate = (newConfig: QuizConfig) => {
    setConfig(newConfig);
    onUpdate(JSON.stringify(newConfig, null, 2));
  };

  const startExam = () => {
    setIsExamStarted(true);
    setIsExamSubmitted(false);
    setUserAnswers({});
    setTimeLeft(config.duration * 60);
    setCurrentQuestionIndex(0);
  };

  const submitExam = () => {
    setIsExamSubmitted(true);
  };

  const resetExam = () => {
    setIsExamStarted(false);
    setIsExamSubmitted(false);
    setUserAnswers({});
    setTimeLeft(config.duration * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    if (isExamSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: uuidv4(),
      type: 'multiple-choice',
      question: 'New Question',
      options: ['Option 1', 'Option 2'],
      correctAnswer: 'Option 1',
      points: 1,
      media: []
    };
    handleUpdate({ ...config, questions: [...config.questions, newQuestion] });
  };

  const removeQuestion = (id: string) => {
    handleUpdate({ ...config, questions: config.questions.filter(q => q.id !== id) });
  };

  const updateQuestion = useCallback((id: string, updatesOrUpdater: Partial<Question> | ((q: Question) => Partial<Question>)) => {
    setConfig(prev => {
      const next = {
        ...prev,
        questions: prev.questions.map(q => {
          if (q.id === id) {
            const updates = typeof updatesOrUpdater === 'function' ? updatesOrUpdater(q) : updatesOrUpdater;
            return { ...q, ...updates };
          }
          return q;
        })
      };
      onUpdate(JSON.stringify(next, null, 2));
      return next;
    });
  }, [onUpdate]);

  const handleFileUpload = async (questionId: string, file: File, type: MediaItem['type']) => {
    const blobId = uuidv4();
    await db.blobs.add({
      id: blobId,
      data: file,
      name: file.name,
      type: file.type,
      createdAt: Date.now()
    });

    const newMedia: MediaItem = {
      id: uuidv4(),
      type,
      blobId
    };

    updateQuestion(questionId, (currQ) => ({
      media: [...(currQ.media || []), newMedia]
    }));
  };

  const markdownComponents = useMemo(() => ({
    code({node, inline, className, children, ...props}: any) {
      const match = /language-([\w-]+)/.exec(className || '');
      const rawCodeContent = String(children).replace(/\n$/, '');
      if (!inline) {
        switch (match?.[1]) {
          case 'mermaid': return <MermaidDiagram chart={rawCodeContent} />;
          case 'smiles': return <SmilesDiagram smiles={rawCodeContent} />;
          case 'plot': return <InteractivePlot configStr={rawCodeContent} onUpdate={() => {}} />;
          case 'model': return <ModelViewerEngine configStr={rawCodeContent} onUpdate={() => {}} readOnly={true} />;
          case 'physics': return <PhysicsSimulation configStr={rawCodeContent} />;
        }
      }
      return <code className={className} {...props}>{children}</code>;
    }
  }), []);

  const calculateScore = () => {
    let score = 0;
    config.questions.forEach(q => {
      const answer = userAnswers[q.id];
      if (q.type === 'multiple-choice' && answer === q.correctAnswer) score += q.points;
      if (q.type === 'fill-in-the-blanks' && String(answer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim()) score += q.points;
      if (q.type === 'matching') {
        let correctPairs = 0;
        q.pairs?.forEach(p => {
          if (answer?.[p.id] === p.right) correctPairs++;
        });
        if (correctPairs === q.pairs?.length) score += q.points;
      }
    });
    return score;
  };

  const totalPoints = config.questions.reduce((sum, q) => sum + q.points, 0);

  const renderMedia = (media: MediaItem[]) => {
    if (!media || media.length === 0) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {media.map(m => {
          const src = m.blobId ? blobUrls[m.blobId] : m.url;
          if (!src && m.type !== 'smiles' && m.type !== 'model') return null;

          return (
            <div key={m.id} className="rounded-xl overflow-hidden border border-border-color bg-bg-sidebar shadow-sm">
              {m.type === 'image' && <img src={src} className="w-full h-auto object-contain max-h-[300px]" referrerPolicy="no-referrer" />}
              {m.type === 'video' && <video src={src} controls className="w-full h-auto max-h-[300px]" />}
              {m.type === 'audio' && (
                <div className="p-4 flex items-center gap-4">
                  <Volume2 className="w-8 h-8 text-blue-500" />
                  <audio src={src} controls className="flex-1" />
                </div>
              )}
              {m.type === 'smiles' && <div className="p-4 bg-bg-sidebar"><SmilesDiagram smiles={m.content || ''} theme="dark" /></div>}
              {m.type === 'model' && <div className="h-[300px]"><ModelViewerEngine configStr={m.content || '{}'} onUpdate={() => {}} readOnly={true} /></div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuestionInput = (question: Question) => {
    const answer = userAnswers[question.id] || {};

    switch (question.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-3 mt-6">
            {question.options?.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswerChange(question.id, opt)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
                  userAnswers[question.id] === opt 
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-md' 
                    : 'border-border-color hover:border-text-muted bg-bg-sidebar hover:bg-hover-bg'
                } ${isExamSubmitted && opt === question.correctAnswer ? 'border-green-500 bg-green-500/10 shadow-none' : ''}
                  ${isExamSubmitted && userAnswers[question.id] === opt && opt !== question.correctAnswer ? 'border-red-500 bg-red-500/10 shadow-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    userAnswers[question.id] === opt ? 'bg-blue-500 border-blue-500 text-white' : 'border-border-color text-text-muted group-hover:border-text-main'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="font-semibold text-text-main">{opt}</span>
                </div>
                {isExamSubmitted && opt === question.correctAnswer && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {isExamSubmitted && userAnswers[question.id] === opt && opt !== question.correctAnswer && <XCircle className="w-5 h-5 text-red-500" />}
              </button>
            ))}
          </div>
        );

      case 'fill-in-the-blanks':
        return (
          <div className="mt-6">
            <input
              type="text"
              value={userAnswers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Type your answer here..."
              className={`w-full p-4 rounded-xl border-2 outline-none transition-all font-bold text-text-main ${
                isExamSubmitted 
                  ? (String(userAnswers[question.id]).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim() ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10')
                  : 'border-border-color focus:border-blue-500 bg-bg-sidebar'
              }`}
            />
            {isExamSubmitted && (
              <div className="mt-3 p-3 bg-green-500/10 rounded-lg text-sm text-green-400 flex items-center gap-2 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4" />
                Correct answer: <span className="font-bold">{question.correctAnswer}</span>
              </div>
            )}
          </div>
        );

      case 'short-answer':
        return (
          <div className="mt-6">
            <textarea
              value={userAnswers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              placeholder="Write your detailed response..."
              className="w-full p-4 rounded-xl border-2 border-border-color focus:border-blue-500 outline-none h-40 resize-none bg-bg-sidebar font-bold text-text-main"
            />
          </div>
        );

      case 'matching':
        return <MatchingInterface question={question} answer={answer} onAnswerChange={(val) => handleAnswerChange(question.id, val)} isSubmitted={isExamSubmitted} markdownComponents={markdownComponents} />;

      default:
        return null;
    }
  };

  // Editor Render
  if (isEditing && !readOnly) {
    return (
      <div className="my-8 bg-bg-main rounded-2xl border border-border-color shadow-2xl overflow-hidden font-sans">
        <div className="bg-bg-sidebar p-6 flex items-center justify-between text-text-main border-b border-border-color">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <div>
              <h3 className="font-bold text-lg leading-tight">Exam Designer</h3>
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Configure your structured quiz</p>
            </div>
          </div>
          <button 
            onClick={() => setIsEditing(false)}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
          >
            <Eye className="w-4 h-4" /> Preview Quiz
          </button>
        </div>

        <div className="p-8 space-y-10 max-h-[800px] overflow-y-auto bg-bg-main">
          {/* Global Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-sidebar p-6 rounded-2xl border border-border-color shadow-sm">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Exam Title</label>
              <input 
                type="text" 
                value={config.title} 
                onChange={(e) => handleUpdate({ ...config, title: e.target.value })}
                className="w-full p-3 border-2 border-border-color bg-bg-main rounded-xl focus:border-blue-500 outline-none font-bold text-text-main transition-all"
                placeholder="e.g. Mid-Term Physics Exam"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Duration (Minutes)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={config.duration} 
                  onChange={(e) => handleUpdate({ ...config, duration: parseInt(e.target.value) || 0 })}
                  className="w-full p-3 border-2 border-border-color bg-bg-main rounded-xl focus:border-blue-500 outline-none font-bold text-text-main transition-all pl-10"
                />
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Description</label>
              <textarea 
                value={config.description} 
                onChange={(e) => handleUpdate({ ...config, description: e.target.value })}
                className="w-full p-3 border-2 border-border-color bg-bg-main rounded-xl focus:border-blue-500 outline-none text-sm text-text-main h-20 resize-none transition-all"
                placeholder="Briefly describe the exam objectives..."
              />
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Questions ({config.questions.length})</h4>
              <button 
                onClick={addQuestion}
                className="text-xs font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>

            {config.questions.map((q, idx) => (
              <div key={q.id} className="bg-bg-sidebar p-6 rounded-2xl border border-border-color shadow-sm relative group hover:shadow-md transition-all">
                <button 
                  onClick={() => removeQuestion(q.id)}
                  className="absolute top-4 right-4 p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <span className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center font-bold text-blue-400">
                    {idx + 1}
                  </span>
                  <select 
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, () => ({ type: e.target.value as QuestionType }))}
                    className="p-2 border-2 border-border-color bg-bg-main rounded-xl text-sm font-bold text-text-main outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="matching">Matching</option>
                    <option value="fill-in-the-blanks">Fill in the Blanks</option>
                    <option value="short-answer">Short Answer</option>
                  </select>
                  <div className="flex items-center gap-2 bg-bg-main px-3 py-1.5 rounded-xl border border-border-color">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Points:</label>
                    <input 
                      type="number" 
                      value={q.points} 
                      onChange={(e) => updateQuestion(q.id, () => ({ points: parseInt(e.target.value) || 1 }))}
                      className="w-10 bg-transparent font-bold text-text-main text-center outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Question Text (Markdown)</label>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Live Preview Below</span>
                    </div>
                    <textarea 
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, () => ({ question: e.target.value }))}
                      placeholder="Enter question content..."
                      className="w-full p-4 border-2 border-border-color bg-bg-main text-text-main rounded-xl text-sm h-32 resize-none focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Question Preview in Editor */}
                  {q.question && (
                    <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                      <div className="markdown-body prose-sm text-text-main">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                          components={markdownComponents}
                        >
                          {q.question}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Media Management */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Media Assets</label>
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-bg-main hover:bg-hover-bg rounded-lg text-xs font-bold text-text-muted hover:text-text-main border border-border-color transition-all flex items-center gap-2">
                        <Upload className="w-3 h-3" /> Upload File
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
                              handleFileUpload(q.id, file, type);
                            }
                          }}
                        />
                      </label>
                      <button 
                        onClick={() => {
                          openModal('Add Image URL', 'https://example.com/image.png', (url) => {
                            updateQuestion(q.id, (currQ) => ({ media: [...(currQ.media || []), { id: uuidv4(), type: 'image', url }] }));
                          });
                        }}
                        className="px-3 py-1.5 bg-bg-main hover:bg-hover-bg rounded-lg text-xs font-bold text-text-muted hover:text-text-main border border-border-color transition-all flex items-center gap-2"
                      >
                        <LinkIcon className="w-3 h-3" /> Add URL
                      </button>
                      <button 
                        onClick={() => {
                          openModal('Add SMILES', 'C1=CC=CC=C1', (smiles) => {
                            updateQuestion(q.id, (currQ) => ({ media: [...(currQ.media || []), { id: uuidv4(), type: 'smiles', content: smiles }] }));
                          });
                        }}
                        className="px-3 py-1.5 bg-bg-main hover:bg-hover-bg rounded-lg text-xs font-bold text-text-muted hover:text-text-main border border-border-color transition-all flex items-center gap-2"
                      >
                        <Beaker className="w-3 h-3" /> Add SMILES
                      </button>
                    </div>
                    
                    {q.media && q.media.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {q.media.map(m => (
                          <div key={m.id} className="relative group/media aspect-square bg-bg-main rounded-lg overflow-hidden border border-border-color">
                            {m.type === 'image' && <img src={m.blobId ? blobUrls[m.blobId] : m.url} className="w-full h-full object-cover" />}
                            {m.type === 'video' && <div className="w-full h-full flex items-center justify-center"><Video className="w-6 h-6 text-text-muted" /></div>}
                            {m.type === 'audio' && <div className="w-full h-full flex items-center justify-center"><Volume2 className="w-6 h-6 text-text-muted" /></div>}
                            {m.type === 'smiles' && <div className="w-full h-full flex items-center justify-center"><Beaker className="w-6 h-6 text-text-muted" /></div>}
                            <button 
                              onClick={() => updateQuestion(q.id, (currQ) => ({ media: currQ.media?.filter(item => item.id !== m.id) }))}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover/media:opacity-100 transition-opacity"
                            >
                              <X className="w-2 h-2" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Type-specific Editor */}
                  {q.type === 'multiple-choice' && (
                    <div className="space-y-3 pt-4 border-t border-border-color">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Answer Options</label>
                      {q.options?.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            checked={q.correctAnswer === opt}
                            onChange={() => updateQuestion(q.id, () => ({ correctAnswer: opt }))}
                            className="w-4 h-4 text-blue-500"
                          />
                          <input 
                            type="text" 
                            value={opt}
                            onChange={(e) => {
                              updateQuestion(q.id, (currQ) => {
                                const newOpts = [...(currQ.options || [])];
                                newOpts[oIdx] = e.target.value;
                                return { options: newOpts };
                              });
                            }}
                            className="flex-1 p-2 border-2 border-border-color bg-bg-main text-text-main rounded-lg text-sm focus:border-blue-500 outline-none transition-all"
                          />
                          <button 
                            onClick={() => {
                              updateQuestion(q.id, (currQ) => {
                                const newOpts = (currQ.options || []).filter((_, i) => i !== oIdx);
                                return { options: newOpts };
                              });
                            }}
                            className="text-text-muted hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => updateQuestion(q.id, (currQ) => ({ options: [...(currQ.options || []), 'New Option'] }))}
                        className="text-xs text-blue-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Option
                      </button>
                    </div>
                  )}

                  {q.type === 'fill-in-the-blanks' && (
                    <div className="space-y-2 pt-4 border-t border-border-color">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Correct Answer</label>
                      <input 
                        type="text" 
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(q.id, () => ({ correctAnswer: e.target.value }))}
                        className="w-full p-3 border-2 border-border-color bg-bg-main text-text-main rounded-xl text-sm focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter the exact correct answer..."
                      />
                    </div>
                  )}

                  {q.type === 'matching' && (
                    <div className="space-y-3 pt-4 border-t border-border-color">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Matching Pairs (Markdown Supported)</label>
                      {q.pairs?.map((pair, pIdx) => (
                        <div key={pair.id} className="flex items-start gap-3 bg-bg-main/50 p-3 rounded-xl border border-border-color">
                          <div className="flex-1 space-y-2">
                            <textarea 
                              value={pair.left}
                              onChange={(e) => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, left: e.target.value } : p);
                                  return { pairs: newPairs };
                                });
                              }}
                              placeholder="Left item (Markdown)"
                              className="w-full p-2 border-2 border-border-color bg-bg-sidebar rounded-lg text-sm focus:border-blue-500 outline-none transition-all h-20 resize-none font-bold text-text-main"
                            />
                            {pair.left && (
                              <div className="p-2 bg-bg-sidebar rounded-lg border border-border-color text-xs">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                                  components={markdownComponents}
                                >
                                  {pair.left}
                                </ReactMarkdown>
                              </div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => openModal('Add Image URL', 'https://example.com/image.png', (url) => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, left: p.left + `\n![Image](${url})` } : p);
                                  return { pairs: newPairs };
                                });
                              })} className="p-1 hover:bg-hover-bg rounded text-text-muted"><ImageIcon className="w-3 h-3" /></button>
                              <button onClick={() => openModal('Add SMILES', 'C1=CC=CC=C1', (smiles) => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, left: p.left + `\n\`\`\`smiles\n${smiles}\n\`\`\`` } : p);
                                  return { pairs: newPairs };
                                });
                              })} className="p-1 hover:bg-hover-bg rounded text-text-muted"><Beaker className="w-3 h-3" /></button>
                              <button onClick={() => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, left: p.left + `\n$$ e = mc^2 $$` } : p);
                                  return { pairs: newPairs };
                                });
                              }} className="p-1 hover:bg-hover-bg rounded text-text-muted"><FileText className="w-3 h-3" /></button>
                            </div>
                          </div>
                          <div className="flex flex-col items-center justify-center h-20">
                            <FlipHorizontal className="w-4 h-4 text-text-muted" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <textarea 
                              value={pair.right}
                              onChange={(e) => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, right: e.target.value } : p);
                                  return { pairs: newPairs };
                                });
                              }}
                              placeholder="Right item (Markdown)"
                              className="w-full p-2 border-2 border-border-color bg-bg-sidebar rounded-lg text-sm focus:border-blue-500 outline-none transition-all h-20 resize-none font-bold text-text-main"
                            />
                            {pair.right && (
                              <div className="p-2 bg-bg-sidebar rounded-lg border border-border-color text-xs">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                                  components={markdownComponents}
                                >
                                  {pair.right}
                                </ReactMarkdown>
                              </div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => openModal('Add Image URL', 'https://example.com/image.png', (url) => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, right: p.right + `\n![Image](${url})` } : p);
                                  return { pairs: newPairs };
                                });
                              })} className="p-1 hover:bg-hover-bg rounded text-text-muted"><ImageIcon className="w-3 h-3" /></button>
                              <button onClick={() => openModal('Add SMILES', 'C1=CC=CC=C1', (smiles) => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, right: p.right + `\n\`\`\`smiles\n${smiles}\n\`\`\`` } : p);
                                  return { pairs: newPairs };
                                });
                              })} className="p-1 hover:bg-hover-bg rounded text-text-muted"><Beaker className="w-3 h-3" /></button>
                              <button onClick={() => {
                                updateQuestion(q.id, (currQ) => {
                                  const newPairs = (currQ.pairs || []).map((p, i) => i === pIdx ? { ...p, right: p.right + `\n$$ e = mc^2 $$` } : p);
                                  return { pairs: newPairs };
                                });
                              }} className="p-1 hover:bg-hover-bg rounded text-text-muted"><FileText className="w-3 h-3" /></button>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              updateQuestion(q.id, (currQ) => {
                                const newPairs = (currQ.pairs || []).filter((_, i) => i !== pIdx);
                                return { pairs: newPairs };
                              });
                            }}
                            className="p-2 text-text-muted hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => updateQuestion(q.id, (currQ) => ({ pairs: [...(currQ.pairs || []), { id: uuidv4(), left: '', right: '' }] }))}
                        className="text-xs text-blue-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Pair
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <button 
              onClick={addQuestion}
              className="w-full py-8 border-2 border-dashed border-border-color rounded-2xl text-text-muted hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex flex-col items-center gap-2"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm font-bold uppercase tracking-widest">Append New Question</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Flashcard Mode
  if (isFlashcardMode) {
    const q = config.questions[currentQuestionIndex];
    return (
      <div className="my-8 flex flex-col items-center gap-8 font-sans">
        <div className="flex items-center justify-between w-full max-w-xl px-4">
          <button onClick={() => setIsFlashcardMode(false)} className="px-4 py-2 bg-bg-sidebar text-text-muted rounded-xl text-xs font-bold uppercase hover:bg-hover-bg transition-all border border-border-color">Exit Flashcards</button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Progress</span>
            <span className="text-sm font-bold text-text-main">{currentQuestionIndex + 1} / {config.questions.length}</span>
          </div>
        </div>

        <div 
          className="relative w-full max-w-xl h-[450px] perspective-1000 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <motion.div
            className="w-full h-full relative preserve-3d transition-all duration-500"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-bg-sidebar rounded-3xl shadow-2xl border border-border-color flex flex-col items-center justify-center p-10 text-center">
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Question</span>
              </div>
              <div className="markdown-body prose-lg w-full max-h-full overflow-y-auto text-text-main">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                  components={markdownComponents}
                >
                  {q?.question || ''}
                </ReactMarkdown>
              </div>
              <div className="absolute bottom-6 flex items-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-widest">
                <RotateCcw className="w-3 h-3" /> Click to flip
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-10 text-center text-white rotate-y-180">
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Answer</span>
              </div>
              <div className="text-3xl font-bold leading-tight mb-6">
                {q?.type === 'multiple-choice' ? q.correctAnswer : 
                 q?.type === 'fill-in-the-blanks' ? q.correctAnswer : 
                 'Check full quiz for details'}
              </div>
              {q?.explanation && (
                <div className="p-4 bg-white/10 rounded-2xl border border-white/10 text-sm text-white/80 italic max-w-md">
                  {q.explanation}
                </div>
              )}
              <div className="absolute bottom-6 flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                <RotateCcw className="w-3 h-3" /> Click to flip back
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            disabled={currentQuestionIndex === 0}
            onClick={(e) => { e.stopPropagation(); setCurrentQuestionIndex(prev => prev - 1); setIsFlipped(false); }}
            className="p-4 bg-bg-sidebar rounded-2xl shadow-xl disabled:opacity-30 hover:scale-110 transition-all border border-border-color"
          >
            <ChevronLeft className="w-6 h-6 text-text-main" />
          </button>
          <button 
            disabled={currentQuestionIndex === config.questions.length - 1}
            onClick={(e) => { e.stopPropagation(); setCurrentQuestionIndex(prev => prev + 1); setIsFlipped(false); }}
            className="p-4 bg-bg-sidebar rounded-2xl shadow-xl disabled:opacity-30 hover:scale-110 transition-all border border-border-color"
          >
            <ChevronRight className="w-6 h-6 text-text-main" />
          </button>
        </div>
      </div>
    );
  }

  // Exam Mode
  if (isExamStarted) {
    const q = config.questions[currentQuestionIndex];
    return (
      <div className="my-8 bg-bg-sidebar rounded-3xl border border-border-color shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-bg-main px-8 py-6 flex items-center justify-between text-text-main">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold leading-tight">{config.title}</h2>
              <span className="text-[10px] text-text-muted uppercase tracking-widest">Question {currentQuestionIndex + 1} of {config.questions.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Time Remaining</span>
              <div className="flex items-center gap-2 bg-bg-sidebar px-4 py-2 rounded-xl border border-border-color">
                <Timer className={`w-4 h-4 ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} />
                <span className={`font-mono text-lg font-bold ${timeLeft < 60 ? 'text-red-400' : ''}`}>{formatTime(timeLeft)}</span>
              </div>
            </div>
            {!isExamSubmitted && (
              <button 
                onClick={submitExam}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
              >
                Finish Exam
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-bg-main w-full">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQuestionIndex + 1) / config.questions.length) * 100}%` }}
          />
        </div>

        {/* Question Area */}
        <div className="p-10 min-h-[500px] bg-bg-main/30">
          {isExamSubmitted ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center max-w-2xl mx-auto">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-28 h-28 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-8 shadow-inner"
              >
                <Award className="w-14 h-14 text-blue-500" />
              </motion.div>
              <h2 className="text-4xl font-bold text-text-main mb-3">Results Summary</h2>
              <p className="text-text-muted mb-10 text-lg">Congratulations! You have successfully completed the <strong>{config.title}</strong>.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mb-12">
                <div className="bg-bg-sidebar p-6 rounded-3xl border border-border-color shadow-sm flex flex-col items-center">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Total Score</span>
                  <span className="text-4xl font-bold text-blue-500">{calculateScore()} <span className="text-lg text-text-muted">/ {totalPoints}</span></span>
                </div>
                <div className="bg-bg-sidebar p-6 rounded-3xl border border-border-color shadow-sm flex flex-col items-center">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Accuracy</span>
                  <span className="text-4xl font-bold text-blue-500">{Math.round((calculateScore() / totalPoints) * 100)}%</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={resetExam}
                  className="px-8 py-3 bg-bg-sidebar text-text-main border border-border-color rounded-xl font-bold hover:bg-hover-bg transition-all shadow-sm"
                >
                  Retake Exam
                </button>
                <button 
                  onClick={() => setIsExamSubmitted(false)}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                >
                  Review Answers
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start gap-6 mb-10">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 shadow-lg shadow-blue-900/20">
                  {currentQuestionIndex + 1}
                </div>
                <div className="flex-1">
                  <div className="markdown-body prose-xl text-text-main mb-8">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                      components={markdownComponents}
                    >
                      {q?.question || ''}
                    </ReactMarkdown>
                  </div>

                  {renderMedia(q?.media || [])}
                  {renderQuestionInput(q)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {!isExamSubmitted && (
          <div className="bg-bg-sidebar px-10 py-6 border-t border-border-color flex items-center justify-between">
            <button 
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-text-muted hover:text-text-main hover:bg-hover-bg disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            
            <div className="hidden sm:flex gap-3">
              {config.questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${idx === currentQuestionIndex ? 'bg-blue-500 scale-125' : 'bg-border-color hover:bg-text-muted'}`}
                />
              ))}
            </div>

            <button 
              disabled={currentQuestionIndex === config.questions.length - 1}
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500/10 text-blue-400 rounded-xl font-bold hover:bg-blue-500/20 disabled:opacity-30 transition-all border border-blue-500/20"
            >
              Next Question <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Start Screen
  return (
    <div className="my-8 bg-bg-sidebar rounded-3xl border border-border-color shadow-2xl overflow-hidden font-sans group">
      <div className="h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />
      
      <div className="p-12 flex flex-col items-center text-center">
        <motion.div 
          whileHover={{ rotate: 15, scale: 1.1 }}
          className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-8 shadow-inner"
        >
          <HelpCircle className="w-10 h-10 text-blue-500" />
        </motion.div>
        
        <h1 className="text-4xl font-bold text-text-main mb-4 tracking-tight">{config.title}</h1>
        <p className="text-text-muted max-w-xl mb-12 text-lg leading-relaxed">{config.description || 'Challenge yourself with this comprehensive interactive assessment. Ensure you are in a quiet environment before starting.'}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 w-full max-w-2xl mb-14">
          <div className="flex flex-col items-center p-4 rounded-2xl bg-bg-main border border-border-color">
            <Layout className="w-6 h-6 text-blue-400 mb-3" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Total Questions</span>
            <span className="text-2xl font-bold text-text-main">{config.questions.length}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-bg-main border border-border-color">
            <Clock className="w-6 h-6 text-indigo-400 mb-3" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Time Limit</span>
            <span className="text-2xl font-bold text-text-main">{config.duration}m</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-bg-main border border-border-color">
            <Award className="w-6 h-6 text-purple-400 mb-3" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Total Points</span>
            <span className="text-2xl font-bold text-text-main">{totalPoints}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5">
          <button 
            onClick={startExam}
            className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-900/20 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center gap-3"
          >
            <Play className="w-6 h-6" /> Start Exam Now
          </button>
          
          <button 
            onClick={() => setIsFlashcardMode(true)}
            className="px-10 py-4 bg-bg-sidebar text-text-main border-2 border-border-color rounded-2xl font-bold hover:bg-hover-bg hover:border-text-muted transition-all flex items-center gap-3"
          >
            <RotateCcw className="w-6 h-6" /> Study Flashcards
          </button>

          {!readOnly && (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-10 py-4 bg-bg-main text-text-main rounded-2xl font-bold hover:bg-hover-bg transition-all flex items-center gap-3 border border-border-color"
            >
              <Edit3 className="w-6 h-6" /> Edit Quiz
            </button>
          )}
        </div>
      </div>

      <div className="bg-bg-main px-12 py-6 border-t border-border-color flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Exam Engine v2.5 Ready</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Multi-Type Questions</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Local Media Storage</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Scientific Rendering</span>
        </div>
      </div>

      {/* Custom Modal for URL/SMILES */}
      <AnimatePresence>
        {modal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-bg-sidebar rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border-color"
            >
              <div className="p-6 border-b border-border-color flex items-center justify-between bg-bg-main text-text-main">
                <h3 className="font-bold">{modal.title}</h3>
                <button onClick={closeModal} className="p-1 hover:bg-hover-bg rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <input 
                  type="text" 
                  autoFocus
                  value={modal.value}
                  onChange={(e) => setModal(prev => ({ ...prev, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      modal.onConfirm(modal.value);
                      closeModal();
                    }
                  }}
                  placeholder={modal.placeholder}
                  className="w-full p-3 border-2 border-border-color bg-bg-main rounded-xl focus:border-blue-500 outline-none font-medium text-text-main"
                />
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={closeModal}
                    className="px-4 py-2 text-text-muted font-bold hover:bg-hover-bg rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      modal.onConfirm(modal.value);
                      closeModal();
                    }}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MatchingInterfaceProps {
  question: Question;
  answer: Record<string, string>;
  onAnswerChange: (val: Record<string, string>) => void;
  isSubmitted: boolean;
  markdownComponents: any;
}

const MatchingInterface: React.FC<MatchingInterfaceProps> = ({ question, answer, onAnswerChange, isSubmitted, markdownComponents }) => {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Record<string, { x: number, y: number }>>({});

  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const newCoords: Record<string, { x: number, y: number }> = {};
    const leftItems = containerRef.current.querySelectorAll('[data-side="left"]');
    const rightItems = containerRef.current.querySelectorAll('[data-side="right"]');

    leftItems.forEach((el: any) => {
      const id = el.getAttribute('data-id');
      const rect = el.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      newCoords[`left-${id}`] = {
        x: rect.right - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top
      };
    });

    rightItems.forEach((el: any) => {
      const val = el.getAttribute('data-val');
      const rect = el.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      newCoords[`right-${val}`] = {
        x: rect.left - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top
      };
    });

    setCoords(newCoords);
  }, []);

  useEffect(() => {
    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [updateCoords, question.pairs]);

  const handleLeftClick = (id: string) => {
    if (isSubmitted) return;
    setSelectedLeft(id === selectedLeft ? null : id);
  };

  const handleRightClick = (val: string) => {
    if (isSubmitted || !selectedLeft) return;
    const newAnswer = { ...answer, [selectedLeft]: val };
    onAnswerChange(newAnswer);
    setSelectedLeft(null);
  };

  const clearMatch = (leftId: string) => {
    if (isSubmitted) return;
    const newAnswer = { ...answer };
    delete newAnswer[leftId];
    onAnswerChange(newAnswer);
  };

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

  return (
    <div className="mt-8 relative" ref={containerRef}>
      <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 10 }}>
        {Object.entries(answer).map(([leftId, rightVal], idx) => {
          const start = coords[`left-${leftId}`];
          const end = coords[`right-${rightVal}`];
          if (!start || !end) return null;

          const isCorrect = isSubmitted && question.pairs?.find(p => p.id === leftId)?.right === rightVal;
          const strokeColor = isSubmitted ? (isCorrect ? '#10b981' : '#ef4444') : colors[idx % colors.length];

          return (
            <motion.line
              key={leftId}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
            />
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-24 relative" style={{ zIndex: 20 }}>
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-2">Column A</h4>
          {question.pairs?.map(pair => (
            <div 
              key={pair.id}
              data-side="left"
              data-id={pair.id}
              onClick={() => handleLeftClick(pair.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${
                selectedLeft === pair.id ? 'border-blue-500 bg-blue-500/10 shadow-md' : 'border-border-color bg-bg-sidebar hover:border-text-muted'
              } ${answer[pair.id] ? 'border-opacity-50' : ''}`}
            >
              <div className="markdown-body text-sm font-bold text-text-main">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                  components={markdownComponents}
                >
                  {pair.left}
                </ReactMarkdown>
              </div>
              {answer[pair.id] && (
                <button 
                  onClick={(e) => { e.stopPropagation(); clearMatch(pair.id); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-bg-main text-text-muted rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-border-color"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-2">Column B</h4>
          {question.pairs?.map(pair => pair.right).sort().map((val, idx) => {
            const isMatched = Object.values(answer).includes(val);
            return (
              <div 
                key={idx}
                data-side="right"
                data-val={val}
                onClick={() => handleRightClick(val)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isMatched ? 'border-border-color bg-bg-main text-text-muted' : 'border-border-color bg-bg-sidebar hover:border-text-muted'
                } ${selectedLeft && !isMatched ? 'hover:border-blue-300 hover:bg-blue-500/10' : ''}`}
              >
                <div className="markdown-body text-sm font-bold text-text-main">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                    components={markdownComponents}
                  >
                    {val}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
