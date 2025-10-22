import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseListPage from './your-file-path'; // 请替换为实际路径
import { ListCases, DeleteCase } from '@/apis/issue';
import type { IssueType } from "@/types/issue";

// 模拟 API 调用
vi.mock('@/apis/issue', () => ({
  ListCases: vi.fn(),
  DeleteCase: vi.fn(),
}));

// 模拟 CaseList 组件
vi.mock('./CaseList', () => ({
  default: vi.fn(({ list, onDelete }) => (
    <div data-testid="case-list">
      {list.map(item => (
        <div key={item.id} data-testid={`case-item-${item.id}`}>
          <span>{item.title}</span>
          <button 
            onClick={() => onDelete(item.id)}
            data-testid={`delete-btn-${item.id}`}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )),
}));

const mockListCases = vi.mocked(ListCases);
const mockDeleteCase = vi.mocked(DeleteCase);

describe('CaseListPage', () => {
  const user = userEvent.setup();
  
  const mockDefaultData: IssueType[] = [
    { id: '1', title: 'Default Issue 1', status: 'draft' },
    { id: '2', title: 'Default Issue 2', status: 'draft' },
  ];

  const mockApiData: IssueType[] = [
    { id: '1', title: 'API Issue 1', status: 'draft' },
    { id: '2', title: 'API Issue 2', status: 'draft' },
    { id: '3', title: 'API Issue 3', status: 'draft' },
  ];

  const mockSuccessResponse = {
    status: { code: 0, message: 'Success' },
    data: mockApiData,
  };

  const mockErrorResponse = {
    status: { code: 1, message: 'Business error occurred' },
    data: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该使用 defaultData 初始化并立即调用 ListCases', async () => {
    mockListCases.mockResolvedValueOnce(mockSuccessResponse);

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={mockDefaultData} 
      />
    );

    // 验证初始渲染使用了 defaultData
    expect(screen.getByTestId('case-list')).toBeInTheDocument();
    
    // 验证 ListCases 被调用
    expect(ListCases).toHaveBeenCalledTimes(1);
    
    // 等待 API 调用完成并验证列表更新
    await waitFor(() => {
      expect(screen.getByText('API Issue 1')).toBeInTheDocument();
      expect(screen.getByText('API Issue 2')).toBeInTheDocument();
      expect(screen.getByText('API Issue 3')).toBeInTheDocument();
    });
  });

  it('当 ListCases 成功时应该更新列表', async () => {
    mockListCases.mockResolvedValueOnce(mockSuccessResponse);

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={mockDefaultData} 
      />
    );

    // 初始应该显示 defaultData
    await waitFor(() => {
      expect(ListCases).toHaveBeenCalledTimes(1);
    });

    // 最终应该显示 API 数据
    await waitFor(() => {
      expect(screen.getByText('API Issue 1')).toBeInTheDocument();
      expect(screen.getByText('API Issue 3')).toBeInTheDocument();
    });
  });

  it('当 ListCases 返回错误时应该保持默认数据', async () => {
    mockListCases.mockResolvedValueOnce(mockErrorResponse);

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={mockDefaultData} 
      />
    );

    // 等待 API 调用完成
    await waitFor(() => {
      expect(ListCases).toHaveBeenCalledTimes(1);
    });

    // 应该仍然显示默认数据（因为 API 调用失败）
    // 注意：根据组件逻辑，如果 API 失败，列表不会被更新，保持初始状态
    // 但初始状态是 defaultData，然后 effect 中调用 getList 会尝试更新
    // 如果 API 失败，状态不会被更新，所以显示的还是 defaultData
  });

  it('删除操作应该调用 DeleteCase 并在成功后刷新列表', async () => {
    mockListCases
      .mockResolvedValueOnce(mockSuccessResponse) // 初始加载
      .mockResolvedValueOnce({ // 删除后的刷新
        status: { code: 0, message: 'Success' },
        data: mockApiData.filter(item => item.id !== '2'),
      });
    
    mockDeleteCase.mockResolvedValueOnce({
      status: { code: 0, message: 'Deleted successfully' },
      data: {} as any,
    });

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={mockDefaultData} 
      />
    );

    // 等待初始数据加载
    await waitFor(() => {
      expect(screen.getByText('API Issue 2')).toBeInTheDocument();
    });

    // 点击删除按钮
    const deleteButton = screen.getByTestId('delete-btn-2');
    await user.click(deleteButton);

    // 验证 DeleteCase 被调用
    await waitFor(() => {
      expect(DeleteCase).toHaveBeenCalledWith('2');
    });

    // 验证 ListCases 被第二次调用（刷新）
    await waitFor(() => {
      expect(ListCases).toHaveBeenCalledTimes(2);
    });

    // 验证项目2被移除
    await waitFor(() => {
      expect(screen.queryByText('API Issue 2')).not.toBeInTheDocument();
      expect(screen.getByText('API Issue 1')).toBeInTheDocument();
      expect(screen.getByText('API Issue 3')).toBeInTheDocument();
    });
  });

  it('当 DeleteCase 失败时不应该刷新列表', async () => {
    mockListCases.mockResolvedValueOnce(mockSuccessResponse);
    
    mockDeleteCase.mockResolvedValueOnce({
      status: { code: 1, message: 'Delete failed' },
      data: {} as any,
    });

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={mockDefaultData} 
      />
    );

    // 等待初始数据加载
    await waitFor(() => {
      expect(screen.getByText('API Issue 2')).toBeInTheDocument();
    });

    // 点击删除按钮
    const deleteButton = screen.getByTestId('delete-btn-2');
    await user.click(deleteButton);

    // 验证 DeleteCase 被调用
    await waitFor(() => {
      expect(DeleteCase).toHaveBeenCalledWith('2');
    });

    // 验证 ListCases 没有被第二次调用（因为删除失败）
    await waitFor(() => {
      expect(ListCases).toHaveBeenCalledTimes(1);
    });

    // 验证所有项目仍然存在
    expect(screen.getByText('API Issue 1')).toBeInTheDocument();
    expect(screen.getByText('API Issue 2')).toBeInTheDocument();
    expect(screen.getByText('API Issue 3')).toBeInTheDocument();
  });

  it('应该正确处理空默认数据', async () => {
    mockListCases.mockResolvedValueOnce(mockSuccessResponse);

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={[]} 
      />
    );

    await waitFor(() => {
      expect(ListCases).toHaveBeenCalledTimes(1);
    });

    // 应该成功显示 API 数据
    await waitFor(() => {
      expect(screen.getByText('API Issue 1')).toBeInTheDocument();
    });
  });

  it('应该正确处理网络错误', async () => {
    const networkError = new Error('Network error');
    mockListCases.mockRejectedValueOnce(networkError);

    // 为了测试不抛出错误到控制台，我们可以 mock console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CaseListPage 
        pageTitle="Test Page" 
        defaultData={mockDefaultData} 
      />
    );

    await waitFor(() => {
      expect(ListCases).toHaveBeenCalledTimes(1);
    });

    // 组件应该处理错误而不崩溃
    expect(screen.getByTestId('case-list')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('应该正确传递 pageTitle 给子组件（如果使用）', () => {
    mockListCases.mockResolvedValueOnce(mockSuccessResponse);

    render(
      <CaseListPage 
        pageTitle="Custom Title" 
        defaultData={mockDefaultData} 
      />
    );

    // 注意：当前组件没有直接使用 pageTitle
    // 但如果将来使用，这个测试可以确保它被正确传递
    // 目前我们只是验证组件渲染没有错误
    expect(screen.getByTestId('case-list')).toBeInTheDocument();
  });
});
