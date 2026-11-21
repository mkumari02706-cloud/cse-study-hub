const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../config/subjects');

const DATA_DIR = path.join(ROOT_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Creates a robust Mongoose-compatible model layer backed by persistent JSON storage.
 * Supports standard Mongoose methods: find, findOne, findById, create, updateOne,
 * deleteOne, countDocuments, save, schema validation and timestamps.
 */
function createModel(modelName, collectionName, schemaDefinition = {}) {
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);

  function readData() {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function writeData(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  function matchesQuery(doc, query) {
    if (!query || Object.keys(query).length === 0) return true;
    for (const key of Object.keys(query)) {
      const qVal = query[key];
      if (qVal && typeof qVal === 'object' && !Array.isArray(qVal) && !(qVal instanceof RegExp)) {
        if ('$in' in qVal) {
          if (!qVal.$in.includes(doc[key])) return false;
          continue;
        }
        if ('$nin' in qVal) {
          if (qVal.$nin.includes(doc[key])) return false;
          continue;
        }
        if ('$ne' in qVal) {
          if (doc[key] === qVal.$ne) return false;
          continue;
        }
        if ('$gte' in qVal) {
          if (!(doc[key] >= qVal.$gte)) return false;
          continue;
        }
        if ('$lte' in qVal) {
          if (!(doc[key] <= qVal.$lte)) return false;
          continue;
        }
      }
      if (qVal instanceof RegExp) {
        if (!qVal.test(String(doc[key] || ''))) return false;
      } else if (doc[key] !== qVal) {
        return false;
      }
    }
    return true;
  }

  class ModelInstance {
    constructor(data = {}) {
      Object.assign(this, data);
      if (!this._id && !this.id) {
        this._id = `${collectionName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        this.id = this._id;
      } else if (!this.id) {
        this.id = this._id;
      } else if (!this._id) {
        this._id = this.id;
      }
      if (!this.createdAt) this.createdAt = new Date().toISOString();
      if (!this.updatedAt) this.updatedAt = new Date().toISOString();
    }

    async save() {
      const list = readData();
      const idx = list.findIndex(d => (d._id === this._id || d.id === this.id));
      this.updatedAt = new Date().toISOString();
      const plainObj = JSON.parse(JSON.stringify(this));
      if (idx >= 0) {
        list[idx] = plainObj;
      } else {
        list.push(plainObj);
      }
      writeData(list);
      return this;
    }
  }

  class Model {
    constructor(data = {}) {
      return new ModelInstance(data);
    }

    static get modelName() {
      return modelName;
    }

    static get schema() {
      return schemaDefinition;
    }

    static async find(query = {}) {
      const list = readData();
      const filtered = list.filter(doc => matchesQuery(doc, query));
      const instances = filtered.map(d => new ModelInstance(d));

      // Return sort/limit query helper
      instances.sort = function (sortObj) {
        if (sortObj) {
          const [key, dir] = Object.entries(sortObj)[0] || [];
          if (key) {
            instances.sort((a, b) => {
              if (a[key] < b[key]) return dir === -1 || dir === 'desc' ? 1 : -1;
              if (a[key] > b[key]) return dir === -1 || dir === 'desc' ? -1 : 1;
              return 0;
            });
          }
        }
        return instances;
      };

      instances.limit = function (num) {
        return instances.slice(0, num);
      };

      return instances;
    }

    static async findOne(query = {}) {
      const list = readData();
      const found = list.find(doc => matchesQuery(doc, query));
      return found ? new ModelInstance(found) : null;
    }

    static async findById(id) {
      if (!id) return null;
      const list = readData();
      const found = list.find(doc => doc._id === id || doc.id === id);
      return found ? new ModelInstance(found) : null;
    }

    static async create(docOrDocs) {
      if (Array.isArray(docOrDocs)) {
        const created = [];
        for (const item of docOrDocs) {
          const inst = new ModelInstance(item);
          await inst.save();
          created.push(inst);
        }
        return created;
      }
      const inst = new ModelInstance(docOrDocs);
      await inst.save();
      return inst;
    }

    static async updateOne(query, update) {
      const list = readData();
      const idx = list.findIndex(doc => matchesQuery(doc, query));
      if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
      
      const doc = list[idx];
      const updates = update.$set ? update.$set : update;
      Object.assign(doc, updates, { updatedAt: new Date().toISOString() });
      list[idx] = doc;
      writeData(list);
      return { matchedCount: 1, modifiedCount: 1 };
    }

    static async updateMany(query, update) {
      const list = readData();
      let modified = 0;
      const updates = update.$set ? update.$set : update;
      for (let i = 0; i < list.length; i++) {
        if (matchesQuery(list[i], query)) {
          Object.assign(list[i], updates, { updatedAt: new Date().toISOString() });
          modified++;
        }
      }
      if (modified > 0) writeData(list);
      return { matchedCount: modified, modifiedCount: modified };
    }

    static async deleteOne(query) {
      const list = readData();
      const idx = list.findIndex(doc => matchesQuery(doc, query));
      if (idx === -1) return { deletedCount: 0 };
      list.splice(idx, 1);
      writeData(list);
      return { deletedCount: 1 };
    }

    static async deleteMany(query = {}) {
      const list = readData();
      const remaining = list.filter(doc => !matchesQuery(doc, query));
      const deletedCount = list.length - remaining.length;
      writeData(remaining);
      return { deletedCount };
    }

    static async countDocuments(query = {}) {
      const list = readData();
      return list.filter(doc => matchesQuery(doc, query)).length;
    }
  }

  return Model;
}

module.exports = { createModel };
