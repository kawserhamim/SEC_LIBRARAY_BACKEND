import ResearchPaper from "../models/research-paper-model.js";

export const createResearchPaper = async (req, res) => {
  try {
    const {
      title,
      authors,
      abstract,
      category,
      keywords,
      paperLink,
      publicationDate,
      journalName,
      conferenceName,
      doi,
    } = req.body;

    if (!title || !authors || !category || !paperLink) {
      return res.status(400).json({
        success: false,
        message: "Title, authors, category and paper link are required",
      });
    }

    if (!Array.isArray(authors) || authors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one author is required",
      });
    }

    for (const author of authors) {
      if (!author.name || !author.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Every author must have a name",
        });
      }
    }

    const paper = await ResearchPaper.create({
      title,
      authors,
      abstract,
      category,
      keywords,
      paperLink,
      publicationDate,
      journalName,
      conferenceName,
      doi,
    });

    return res.status(201).json({
      success: true,
      message: "Research paper created successfully",
      paper,
    });
  } catch (error) {
    console.error("Create research paper error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A research paper with this DOI already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create research paper",
    });
  }
};

export const getAllResearchPapers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 3, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { isPublished: true };

    const [papers, totalPapers] = await Promise.all([
      ResearchPaper.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ResearchPaper.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalPapers / limit);

    return res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        limit,
        totalPapers,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      papers,
    });
  } catch (error) {
    console.error("Get all research papers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch research papers",
    });
  }
};

export const getResearchPaperById = async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ResearchPaper.findOne({ _id: id, isPublished: true }).lean();

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found",
      });
    }

    return res.status(200).json({ success: true, paper });
  } catch (error) {
    console.error("Get research paper error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch research paper",
    });
  }
};

export const searchResearchPapers = async (req, res) => {
  try {
    const {
      query,
      title,
      author,
      category,
      keyword,
      journal,
      conference,
      doi,
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(parseInt(page) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const skip = (currentPage - 1) * perPage;

    const filter = { isPublished: true };

    if (query && query.trim()) {
      const search = query.trim();
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { "authors.name": { $regex: search, $options: "i" } },
        { abstract: { $regex: search, $options: "i" } },
        { keywords: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { journalName: { $regex: search, $options: "i" } },
        { conferenceName: { $regex: search, $options: "i" } },
        { doi: { $regex: search, $options: "i" } },
      ];
    }

    if (title && title.trim()) filter.title = { $regex: title.trim(), $options: "i" };
    if (author && author.trim()) filter["authors.name"] = { $regex: author.trim(), $options: "i" };
    if (category && category.trim()) filter.category = { $regex: category.trim(), $options: "i" };
    if (keyword && keyword.trim()) filter.keywords = { $regex: keyword.trim(), $options: "i" };
    if (journal && journal.trim()) filter.journalName = { $regex: journal.trim(), $options: "i" };
    if (conference && conference.trim()) filter.conferenceName = { $regex: conference.trim(), $options: "i" };
    if (doi && doi.trim()) filter.doi = { $regex: doi.trim(), $options: "i" };

    const [papers, totalPapers] = await Promise.all([
      ResearchPaper.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
      ResearchPaper.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalPapers / perPage);

    return res.status(200).json({
      success: true,
      search: {
        query: query || null,
        title: title || null,
        author: author || null,
        category: category || null,
        keyword: keyword || null,
        journal: journal || null,
        conference: conference || null,
        doi: doi || null,
      },
      pagination: {
        currentPage,
        limit: perPage,
        totalPapers,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
      papers,
    });
  } catch (error) {
    console.error("Search research papers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search research papers",
    });
  }
};

export const updateResearchPaper = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      authors,
      abstract,
      category,
      keywords,
      paperLink,
      publicationDate,
      journalName,
      conferenceName,
      doi,
      isPublished,
    } = req.body;

    const paper = await ResearchPaper.findByIdAndUpdate(
      id,
      {
        title,
        authors,
        abstract,
        category,
        keywords,
        paperLink,
        publicationDate,
        journalName,
        conferenceName,
        doi,
        isPublished,
      },
      { new: true, runValidators: true }
    );

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research paper updated successfully",
      paper,
    });
  } catch (error) {
    console.error("Update research paper error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A research paper with this DOI already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to update research paper",
    });
  }
};

export const deleteResearchPaper = async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ResearchPaper.findByIdAndDelete(id);

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Research paper not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Research paper deleted successfully",
    });
  } catch (error) {
    console.error("Delete research paper error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete research paper",
    });
  }
};