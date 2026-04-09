import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const CreateWorkspace = mutation({
    args:{
        messages:v.any(),
        userId:v.string(),
        title:v.optional(v.string()),
    },
    handler:async(ctx,args)=>{
        const now = Date.now();
        const workspaceId = await ctx.db.insert('workspace',{
            messages:args.messages,
            userId:args.userId,
            title:args.title,
            createdAt: now,
            updatedAt: now,
        });
        return workspaceId;
    }
})

export const GetWorkspace = query({ 
    args:{
        workspaceId:v.id('workspace'),
        userId:v.string(),
    },
    handler:async(ctx,args)=>{
        const result = await ctx.db.get(args.workspaceId);
        if (!result || result.userId !== args.userId) return null;
        return result;
    }
})

export const UpdateWorkspace = mutation({
    args:{
        workspaceId:v.id('workspace'),
        messages:v.any(),
        userId:v.string(),
        title:v.optional(v.string()),
    },
    handler:async(ctx,args)=>{
        const existing = await ctx.db.get(args.workspaceId);
        if (!existing || existing.userId !== args.userId) return null;
        const patch = {
            messages: args.messages,
            updatedAt: Date.now(),
        };
        if (typeof args.title === 'string' && args.title.trim().length > 0) {
            patch.title = args.title;
        }
        const result=await ctx.db.patch(args.workspaceId,{
            ...patch
        });
        return result;
    }
})

export const UpdateFiles = mutation({
    args:{
        workspaceId:v.id('workspace'),
        files:v.any(),
        userId:v.string(),
        title:v.optional(v.string()),
    },
    handler:async(ctx,args)=>{
        const existing = await ctx.db.get(args.workspaceId);
        if (!existing || existing.userId !== args.userId) return null;
        const patch = {
            fileData: args.files,
            updatedAt: Date.now(),
        };
        if (typeof args.title === 'string' && args.title.trim().length > 0) {
            patch.title = args.title;
        }
        const result=await ctx.db.patch(args.workspaceId,{
            ...patch
        });
        return result;
    }
})

export const ListWorkspacesByUser = query({
    args: {
        userId: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = typeof args.limit === 'number' ? args.limit : 24;
        const results = await ctx.db
            .query('workspace')
            .withIndex('by_user_updated', (q) => q.eq('userId', args.userId))
            .order('desc')
            .take(limit);

        return results.map((item) => ({
            _id: item._id,
            title: item.title || 'Untitled Project',
            createdAt: item.createdAt ?? 0,
            updatedAt: item.updatedAt ?? item.createdAt ?? 0,
        }));
    }
})

export const RenameWorkspace = mutation({
    args: {
        workspaceId: v.id('workspace'),
        userId: v.string(),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.workspaceId);
        if (!existing || existing.userId !== args.userId) return null;
        const cleanTitle = args.title.trim();
        if (!cleanTitle) return null;
        const result = await ctx.db.patch(args.workspaceId, {
            title: cleanTitle,
            updatedAt: Date.now(),
        });
        return result;
    }
})

export const DeleteWorkspace = mutation({
    args: {
        workspaceId: v.id('workspace'),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.get(args.workspaceId);
        if (!existing || existing.userId !== args.userId) return null;
        await ctx.db.delete(args.workspaceId);
        return { success: true };
    }
})
