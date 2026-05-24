---
schema_version: "2.0.0"
id: mongoose
name: "Mongoose"
version: "2.0.0"
description: "Mongoose ODM for MongoDB with typed schemas, single connection, model-layer queries with .lean(), and index-backed query performance."
category: pattern
language: javascript
frameworks:
  - mongoose
dependencies:
  none:
    - prisma
    - drizzle-orm
    - "@prisma/client"
detection:
  dependencies:
    any:
      - mongoose
  source_indicators:
    - "mongoose.connect("
    - "new Schema("
    - "model("
    - "mongoose.model("
    - "from 'mongoose'"
structure:
  required_dirs:
    - path: src/models
      purpose: "Mongoose schema and model definitions  -  one file per collection (e.g., user.model.ts, post.model.ts). Each file exports the Mongoose model and the TypeScript interface that describes the document shape. Models are the only layer that calls mongoose.model() and defines Schema instances."
    - path: src/lib
      purpose: "Database connection singleton in db.ts  -  the only place that calls mongoose.connect(). This module is imported once (in the app entry point or Next.js instrumentation) and handles reconnect logic. Never call mongoose.connect() in route handlers or models."
  recommended_dirs:
    - path: src/repositories
      purpose: "Data access layer  -  one file per model (e.g., user.repository.ts) containing all queries for that collection. Repository functions call Model.find(), Model.findById(), etc. and return typed lean documents. Services call repositories  -  never the Mongoose Model directly."
    - path: src/types
      purpose: "Shared TypeScript interfaces for document types (HydratedDocument<User>, lean User). Keeps model files focused on schema definition and separates type definitions for reuse across layers."
separation:
  rules:
    - concern: schema_definition
      belongs_in: src/models
      rule_text: "Define all Mongoose schemas in src/models/ with explicit types matching the TypeScript interface. Always include { timestamps: true } in schema options  -  Mongoose then manages createdAt and updatedAt automatically. Add index: true or unique: true to fields you query frequently."
      example: |
        // src/models/user.model.ts
        import { Schema, model, type Document } from 'mongoose';

        export interface IUser {
          email: string;
          name: string;
          role: 'user' | 'admin';
          profileId?: string;
          createdAt: Date; // added by { timestamps: true }
          updatedAt: Date;
        }

        const userSchema = new Schema<IUser>(
          {
            email: { type: String, required: true, unique: true, lowercase: true, trim: true },
            name:  { type: String, required: true, trim: true },
            role:  { type: String, enum: ['user', 'admin'], default: 'user' },
            profileId: { type: String, index: true }, // indexed for fast lookup
          },
          {
            timestamps: true, // auto-manages createdAt and updatedAt
            toJSON: { virtuals: true }, // include virtuals in JSON output
          }
        );

        export const User = model<IUser>('User', userSchema);
      indicators:
        - "new Schema("
        - "mongoose.model("
        - "model<I"
        - "timestamps: true"
    - concern: single_connection
      belongs_in: src/lib
      rule_text: "Call mongoose.connect() exactly once in src/lib/db.ts using the cached connection pattern. In Next.js, the connection is shared across hot reloads  -  without caching the connection promise, each module reload creates a new connection to MongoDB until the pool limit is hit."
      example: |
        // src/lib/db.ts
        import mongoose from 'mongoose';

        declare global {
          // eslint-disable-next-line no-var
          var mongoose: { conn: typeof import('mongoose') | null; promise: Promise<typeof import('mongoose')> | null };
        }

        let cached = global.mongoose ?? { conn: null, promise: null };
        if (!global.mongoose) global.mongoose = cached;

        export async function connectDB() {
          if (cached.conn) return cached.conn;
          if (!cached.promise) {
            cached.promise = mongoose.connect(process.env.MONGODB_URI!, {
              bufferCommands: false,
              maxPoolSize: process.env.NODE_ENV === 'production' ? 10 : 2,
            });
          }
          cached.conn = await cached.promise;
          return cached.conn;
        }
      anti_indicators:
        - "mongoose.connect("
    - concern: query_performance
      belongs_in: src/repositories
      rule_text: "Use .lean() on read queries that don't need Mongoose document methods (.save(), virtuals, middleware). lean() returns plain JavaScript objects instead of full Mongoose documents  -  2-10x faster for large result sets. Use .select() to limit returned fields and .limit() to cap result size."
      example: |
        // src/repositories/user.repository.ts
        import { connectDB } from '@/lib/db';
        import { User, type IUser } from '@/models/user.model';

        // lean() + select(): fast, minimal-payload read
        export async function listUsers(limit = 50): Promise<Partial<IUser>[]> {
          await connectDB();
          return User.find({ role: 'user' })
            .select('email name createdAt') // only the fields callers need
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(); // plain objects  -  no Mongoose overhead
        }

        // No .lean() when mutation is needed (need .save())
        export async function findUserById(id: string) {
          await connectDB();
          return User.findById(id); // returns HydratedDocument<IUser>
        }
      indicators:
        - ".lean()"
        - ".find({"
        - ".sort("
        - ".select("
        - ".limit("
    - concern: population
      belongs_in: src/repositories
      rule_text: "Use .populate() to fetch referenced documents in a single aggregated query instead of manually fetching references in a loop. Pre-populate only the fields the caller needs using the second argument or select option."
      example: |
        // src/repositories/post.repository.ts
        export async function listPostsWithAuthors(limit = 20) {
          await connectDB();
          return Post.find({ publishedAt: { $ne: null } })
            .populate<{ author: IUser }>('author', 'name email') // only name + email from User
            .sort({ publishedAt: -1 })
            .limit(limit)
            .lean();
        }
      indicators:
        - ".populate("
    - concern: transactions
      belongs_in: src/repositories
      rule_text: "Use Mongoose sessions and transactions for operations that span multiple collections and must be atomic. Requires a MongoDB replica set (available on Atlas M10+ or local replica set). Pass the session to every operation that participates in the transaction."
      example: |
        // src/repositories/transfer.repository.ts
        import mongoose from 'mongoose';
        import { Account } from '@/models/account.model';
        import { Transaction } from '@/models/transaction.model';

        export async function transferFunds(fromId: string, toId: string, amount: number) {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await Account.findByIdAndUpdate(fromId, { $inc: { balance: -amount } }, { session });
            await Account.findByIdAndUpdate(toId, { $inc: { balance: amount } }, { session });
            await Transaction.create([{ fromId, toId, amount }], { session });
            await session.commitTransaction();
          } catch (err) {
            await session.abortTransaction();
            throw err;
          } finally {
            session.endSession();
          }
        }
      indicators:
        - "mongoose.startSession"
        - "startTransaction"
        - "commitTransaction"
        - "abortTransaction"
    - concern: input_validation
      belongs_in: src/services
      rule_text: "Validate and sanitize all user input before passing to Mongoose queries. MongoDB is vulnerable to query injection when user input is used directly in query operators — an attacker can pass { '$gt': '' } instead of a string to bypass filters. Always validate ObjectId format before using in findById. Use a schema library (Zod, Joi) at the service boundary, not just Mongoose schema validation (which runs too late)."
      example: |
        // src/services/user.service.ts
        import { z } from 'zod';
        import { Types } from 'mongoose';
        import { User } from '../models/user.model';

        const ObjectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), 'Invalid ID');

        export async function getUser(id: unknown) {
          const validId = ObjectIdSchema.parse(id);
          return User.findById(validId).lean();
        }
      indicators:
        - "ObjectId.isValid"
        - ".parse("
        - "z.string()"
    - concern: connection_config
      belongs_in: src/lib
      rule_text: "Configure the MongoDB connection in a single module (src/lib/db.ts) with environment-specific settings. Set connection pool size (default 5 in development, higher in production), replica set name, and read preference via the connection string or MongooseConnectOptions. Validate DATABASE_URL at startup — fail fast if missing. Use mongoose.connection events to log connection state."
      example: |
        // src/lib/db.ts
        import mongoose from 'mongoose';

        const MONGODB_URI = process.env.DATABASE_URL;
        if (!MONGODB_URI) throw new Error('DATABASE_URL environment variable is required');

        const options: mongoose.ConnectOptions = {
          maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 5,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        };

        let cached = global.__mongoose;
        if (!cached) cached = global.__mongoose = { conn: null, promise: null };

        export async function connectDB() {
          if (cached.conn) return cached.conn;
          if (!cached.promise) {
            cached.promise = mongoose.connect(MONGODB_URI, options);
          }
          cached.conn = await cached.promise;
          return cached.conn;
        }
      indicators:
        - "maxPoolSize"
        - "connectDB"
        - "mongoose.connect"
patterns:
  data_flow:
    direction: "API Route/Server Action → Service → Repository → Mongoose Model → MongoDB"
    rules:
      - "src/lib/db.ts connectDB() is called before every repository operation  -  safely no-ops if already connected."
      - "Repositories return plain JavaScript objects (via .lean()) or HydratedDocument only when mutation is needed."
      - "Services call repository functions  -  never import Mongoose Models directly."
      - "Use .populate() for relations  -  never loop with findById() to fetch referenced documents."
      - "All queries on frequently-filtered fields have matching index: true in the schema."
  error_handling:
    recommended: "Mongoose validation errors are instanceof mongoose.Error.ValidationError  -  catch separately from MongoDB driver errors. For duplicate key errors, check err.code === 11000 (MongoDB duplicate key)."
  naming:
    models: "src/models/[resource].model.ts  -  e.g. user.model.ts exports User model + IUser interface"
    connection: "src/lib/db.ts  -  exports connectDB() using cached connection pattern"
    repositories: "src/repositories/[resource].repository.ts  -  e.g. user.repository.ts"
anti_patterns:
  - id: multiple_connections
    severity: critical
    description: "Calling mongoose.connect() in individual model files, route handlers, or repository functions. In serverless environments, each function invocation recreates the connection  -  MongoDB Atlas free-tier clusters hit connection limits instantly."
    bad_example: |
      // ❌ mongoose.connect() in a route handler  -  new connection per request
      export async function GET() {
        await mongoose.connect(process.env.MONGODB_URI!); // new connection every request!
        const users = await User.find().lean();
        return Response.json(users);
      }
    good_example: |
      // ✓ Call connectDB() which uses the cached singleton
      import { connectDB } from '@/lib/db';
      export async function GET() {
        await connectDB(); // no-op if already connected
        const users = await User.find().lean();
        return Response.json(users);
      }
  - id: schema_in_route
    severity: critical
    description: "Defining Mongoose schemas inside route handlers or service functions  -  the schema and model are recreated on every call. In Next.js, this also triggers a `Cannot overwrite model once compiled` error after HMR because the model name is already registered."
    bad_example: |
      // ❌ Schema defined inside a route handler  -  recreated every call
      export async function GET() {
        const UserSchema = new Schema({ email: String }); // recreated every request
        const User = model('User', UserSchema); // throws on second call: model already registered
        return Response.json(await User.find());
      }
    good_example: |
      // ✓ Schema defined once in src/models/user.model.ts
      // import the model from there in all route handlers and repositories
      import { User } from '@/models/user.model';
  - id: populate_n_plus_one
    severity: warning
    description: "Fetching documents with references and then manually looping to fetch each referenced document. This creates N+1 database round trips  -  one query for the list, then one per document for its reference."
    bad_example: |
      // ❌ N+1: 1 query for posts + 1 query per post for its author
      const posts = await Post.find({ publishedAt: { $ne: null } }).lean();
      for (const post of posts) {
        post.author = await User.findById(post.authorId).lean(); // N separate queries
      }
    good_example: |
      // ✓ Single aggregated query via populate
      const posts = await Post.find({ publishedAt: { $ne: null } })
        .populate('author', 'name email') // single JOIN-like query
        .lean();
  - id: missing_schema_index
    severity: warning
    description: "Querying a field frequently without adding index: true (or a compound index) to the schema. Without an index, MongoDB scans every document in the collection on each query  -  O(n) queries that degrade linearly as data grows."
    bad_example: |
      // ❌ userId queried often but no index  -  full collection scan on every query
      const userSchema = new Schema({
        email: String,
        userId: String, // frequently queried but not indexed
      }, { timestamps: true });

      // In repository:
      User.find({ userId }) // COLLSCAN on 1M documents = slow
    good_example: |
      // ✓ Add index to frequently-queried fields
      const userSchema = new Schema({
        email: { type: String, unique: true }, // unique implies index
        userId: { type: String, index: true }, // explicit index for fast lookup
      }, { timestamps: true });
  - id: schema_without_timestamps
    severity: warning
    description: "Defining schemas without `{ timestamps: true }` and manually managing createdAt/updatedAt fields. Manual timestamp management is error-prone  -  it's easy to forget to update updatedAt on every modification."
    bad_example: |
      // ❌ Manual timestamps  -  easy to forget updatedAt on updates
      const postSchema = new Schema({
        title: String,
        content: String,
        createdAt: { type: Date, default: Date.now }, // missing from updates
        updatedAt: Date, // must manually set on every save
      });
    good_example: |
      // ✓ Mongoose manages both createdAt and updatedAt automatically
      const postSchema = new Schema(
        {
          title: { type: String, required: true },
          content: String,
        },
        { timestamps: true } // auto-sets createdAt and updatedAt
      );
  - id: excessive_lean
    severity: warning
    description: "Using .lean() on queries where you then call Mongoose document methods (.save(), .validate(), middleware hooks). .lean() returns plain JavaScript objects  -  calling .save() on them throws at runtime."
    bad_example: |
      // ❌ .lean() then .save()  -  TypeError at runtime
      const user = await User.findById(id).lean(); // plain object, not a Mongoose doc
      user.name = 'New Name';
      await user.save(); // TypeError: user.save is not a function
    good_example: |
      // ✓ Skip .lean() when you need to mutate and save
      const user = await User.findById(id); // HydratedDocument<IUser>
      if (!user) throw new Error('User not found');
      user.name = 'New Name';
      await user.save(); // works  -  Mongoose document method

      // ✓ Or use findByIdAndUpdate for simpler mutations
      await User.findByIdAndUpdate(id, { name: 'New Name' }, { new: true });
  - id: no_connection_pooling
    severity: warning
    description: "Calling mongoose.connect() in every request handler or module without caching the connection. Each call creates a new connection pool — in serverless environments this exhausts MongoDB's connection limit within minutes."
    bad_example: |
      // Called in every API route — new pool per request
      export async function handler(req, res) {
        await mongoose.connect(process.env.DATABASE_URL);
        const users = await User.find();
        res.json(users);
      }
    good_example: |
      // Cached singleton — one pool shared across all requests
      import { connectDB } from '@/lib/db';
      export async function handler(req, res) {
        await connectDB(); // reuses existing connection
        const users = await User.find();
        res.json(users);
      }
  - id: nosql_injection
    severity: critical
    description: "User input used directly in MongoDB query operators without sanitization. An attacker can send { '$gt': '' } as a query parameter value, turning an equality check into a 'match everything' query that leaks data."
    bad_example: |
      // req.query.email could be { '$gt': '' } instead of a string
      const user = await User.findOne({ email: req.query.email });
    good_example: |
      const EmailSchema = z.string().email();
      const email = EmailSchema.parse(req.query.email); // rejects non-string input
      const user = await User.findOne({ email });
  - id: oversized_model_file
    severity: warning
    description: "A model file contains 300+ LOC mixing schema definition, static methods, instance methods, and query helpers. Split statics and complex queries into a separate service or repository."
    bad_example: |
      // models/Order.ts  -  500 LOC  -  schema + 20 static methods + virtual fields + hooks
    good_example: |
      // models/Order.ts  -  80 LOC  -  schema, virtuals, hooks only
      // services/order.service.ts  -  120 LOC  -  business logic and complex queries

---
