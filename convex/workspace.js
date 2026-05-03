import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
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
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('workspace')
            .withIndex('by_user_updated', (q) => q.eq('userId', args.userId))
            .order('desc')
            .paginate(args.paginationOpts);
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

export const DeleteWorkspaces = mutation({
    args: {
        workspaceIds: v.array(v.id('workspace')),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const uniqueWorkspaceIds = [...new Set(args.workspaceIds)];
        let deletedCount = 0;

        for (const workspaceId of uniqueWorkspaceIds) {
            const existing = await ctx.db.get(workspaceId);
            if (!existing || existing.userId !== args.userId) continue;
            await ctx.db.delete(workspaceId);
            deletedCount += 1;
        }

        return { success: true, deletedCount };
    }
})
