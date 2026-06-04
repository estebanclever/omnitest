'use client';

import React, { useState, useEffect } from 'react';
import {
  Layout,
  Typography,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Card,
  Row,
  Col,
  ConfigProvider,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ThunderboltOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { ProductionOrder, OrderStatus } from '@omnitest/shared-types';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// URLs de conexión configuradas para entorno Docker y fallback local
const DIRECTUS_URL = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'http://localhost:8055';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [form] = Form.useForm();

  // Cargar órdenes desde Directus CMS al montar la página
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${DIRECTUS_URL}/items/production_orders`, {
        params: {
          sort: '-createdAt',
        },
      });
      setOrders(response.data.data || []);
    } catch (error: any) {
      console.error('Error al cargar órdenes de Directus:', error);
      message.error('No se pudieron cargar las órdenes de producción. Verifica que Directus esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Abrir modal para crear una nueva orden
  const openCreateModal = () => {
    setEditingOrder(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'planned',
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar una orden existente
  const openEditModal = (order: ProductionOrder) => {
    setEditingOrder(order);
    form.setFieldsValue({
      reference: order.reference,
      product: order.product,
      quantity: order.quantity,
      status: order.status,
      dates: [dayjs(order.startDate), dayjs(order.endDate)],
    });
    setIsModalOpen(true);
  };

  // Enviar formulario (Crear o Actualizar)
  const handleSubmit = async (values: any) => {
    const { reference, product, quantity, status, dates } = values;
    const startDate = dates[0].toISOString();
    const endDate = dates[1].toISOString();

    const payload: any = {
      reference,
      product,
      quantity,
      status,
      startDate,
      endDate,
    };

    // Directus requiere UUID explícito al crear (campo no tiene auto-generación)
    if (!editingOrder) {
      payload.id = crypto.randomUUID();
    }

    try {
      if (editingOrder) {
        // Actualizar en Directus
        await axios.patch(`${DIRECTUS_URL}/items/production_orders/${editingOrder.id}`, payload);
        message.success('Orden de producción actualizada correctamente.');
      } else {
        // Crear en Directus
        await axios.post(`${DIRECTUS_URL}/items/production_orders`, payload);
        message.success('Orden de producción creada correctamente.');
      }
      setIsModalOpen(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error al guardar la orden:', error);
      message.error('Ocurrió un error al guardar la orden de producción.');
    }
  };

  // Eliminar orden de producción
  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '¿Estás seguro de eliminar esta orden?',
      content: 'Esta acción no se puede deshacer.',
      okText: 'Sí, eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await axios.delete(`${DIRECTUS_URL}/items/production_orders/${id}`);
          message.success('Orden eliminada correctamente.');
          fetchOrders();
        } catch (error: any) {
          console.error('Error al eliminar la orden:', error);
          message.error('No se pudo eliminar la orden de producción.');
        }
      },
    });
  };

  // Llamar al endpoint de reprogramación en NestJS
  const handleReschedule = async () => {
    setRescheduling(true);
    const hideLoading = message.loading('Reprogramando órdenes en conflicto...', 0);
    try {
      const response = await axios.post(`${BACKEND_URL}/production-orders/reschedule`);
      hideLoading();
      
      const { updatedCount } = response.data;
      if (updatedCount > 0) {
        message.success(`Reprogramación completada con éxito. Se actualizaron ${updatedCount} órdenes.`);
      } else {
        message.info('No se detectaron solapamientos en órdenes planificadas.');
      }
      fetchOrders();
    } catch (error: any) {
      hideLoading();
      console.error('Error al reprogramar órdenes:', error);
      message.error('Error en el servicio de reprogramación de NestJS.');
    } finally {
      setRescheduling(false);
    }
  };

  // Calcular métricas de resumen
  const kpis = {
    total: orders.length,
    planned: orders.filter(o => o.status === 'planned').length,
    scheduled: orders.filter(o => o.status === 'scheduled').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  // Definición de las columnas de la tabla
  const columns = [
    {
      title: 'Referencia',
      dataIndex: 'reference',
      key: 'reference',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Producto',
      dataIndex: 'product',
      key: 'product',
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty: number) => <Text>{qty.toLocaleString()}</Text>,
    },
    {
      title: 'Fecha de Inicio',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date: string) => (
        <span>
          <CalendarOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
          {dayjs(date).format('DD/MM/YYYY HH:mm')}
        </span>
      ),
    },
    {
      title: 'Fecha de Fin',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date: string) => (
        <span>
          <CalendarOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
          {dayjs(date).format('DD/MM/YYYY HH:mm')}
        </span>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => {
        let color = 'default';
        let label = status.toUpperCase();
        if (status === 'planned') {
          color = 'blue';
          label = 'Planificada';
        } else if (status === 'scheduled') {
          color = 'cyan';
          label = 'Programada';
        } else if (status === 'in_progress') {
          color = 'orange';
          label = 'En Progreso';
        } else if (status === 'completed') {
          color = 'green';
          label = 'Completada';
        }
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Creada el',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: ProductionOrder) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#1677ff' }} />}
            onClick={() => openEditModal(record)}
          />
          <Button
            type="text"
            icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 12,
          fontFamily: 'var(--font-geist-sans)',
        },
      }}
    >
      {/* Esferas de degradado decorativas de fondo */}
      <div className="gradient-bg">
        <div className="gradient-sphere-1"></div>
        <div className="gradient-sphere-2"></div>
      </div>

      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        <Header
          className="glass-panel"
          style={{
            margin: '16px 24px 0 24px',
            padding: '0 24px',
            height: '70px',
            lineHeight: '70px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <InboxOutlined style={{ fontSize: '28px', color: '#6366f1' }} />
            <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
              OmniTest Orders
            </Title>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchOrders}
              loading={loading}
            >
              Refrescar
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              Nueva Orden
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: '24px 24px 0 24px' }}>
          {/* Tarjetas KPI de Resumen */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={12} sm={12} md={6}>
              <Card className="glass-panel hover-scale" bordered={false}>
                <Text type="secondary">Total Órdenes</Text>
                <Title level={2} style={{ margin: '4px 0 0 0' }}>{kpis.total}</Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card className="glass-panel hover-scale" bordered={false} style={{ borderLeft: '4px solid #1677ff' }}>
                <Text type="secondary">Planificadas (En conflicto?)</Text>
                <Title level={2} style={{ margin: '4px 0 0 0', color: '#1677ff' }}>{kpis.planned}</Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card className="glass-panel hover-scale" bordered={false} style={{ borderLeft: '4px solid #fa8c16' }}>
                <Text type="secondary">En Progreso</Text>
                <Title level={2} style={{ margin: '4px 0 0 0', color: '#fa8c16' }}>{kpis.inProgress}</Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card className="glass-panel hover-scale" bordered={false} style={{ borderLeft: '4px solid #52c41a' }}>
                <Text type="secondary">Completadas</Text>
                <Title level={2} style={{ margin: '4px 0 0 0', color: '#52c41a' }}>{kpis.completed}</Title>
              </Card>
            </Col>
          </Row>

          {/* Panel Principal */}
          <Card
            className="glass-panel"
            bordered={false}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <Title level={5} style={{ margin: 0 }}>
                  Listado de Órdenes de Producción
                </Title>
                <Space>
                  <Tooltip title="Busca órdenes en estado 'Planificada' que compartan fechas de solapamiento y las reprograma de forma consecutiva según su fecha de creación.">
                    <Button
                      type="primary"
                      danger
                      icon={<ThunderboltOutlined />}
                      onClick={handleReschedule}
                      loading={rescheduling}
                      disabled={kpis.planned < 2}
                    >
                      Resolver Conflictos (Reprogramar)
                    </Button>
                  </Tooltip>
                </Space>
              </div>
            }
          >
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 8 }}
              locale={{
                emptyText: 'No se encontraron órdenes de producción. Crea una para empezar.',
              }}
            />
          </Card>
        </Content>

        <Footer style={{ textAlign: 'center', background: 'transparent' }}>
          OmniTest Production Orders ©2026 - Senior Fullstack Challenge
        </Footer>
      </Layout>

      {/* Modal para Crear y Editar */}
      <Modal
        title={editingOrder ? 'Editar Orden de Producción' : 'Crear Orden de Producción'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        okText={editingOrder ? 'Guardar Cambios' : 'Crear Orden'}
        cancelText="Cancelar"
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: 'planned',
          }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="reference"
            label="Referencia de Orden"
            rules={[
              { required: true, message: 'Ingresa la referencia (ej. ORD-001)' },
              { whitespace: true, message: 'La referencia no puede estar vacía' },
            ]}
          >
            <Input placeholder="Ej. ORD-001" />
          </Form.Item>

          <Form.Item
            name="product"
            label="Nombre del Producto"
            rules={[
              { required: true, message: 'Ingresa el nombre del producto' },
              { whitespace: true, message: 'El producto no puede estar vacío' },
            ]}
          >
            <Input placeholder="Ej. Filtro de Aire Industrial" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="Cantidad"
                rules={[
                  { required: true, message: 'Ingresa la cantidad' },
                  { type: 'number', min: 1, message: 'La cantidad debe ser mayor a 0' },
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="Cant." min={1} precision={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Estado"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="planned">Planificada</Select.Option>
                  <Select.Option value="scheduled">Programada</Select.Option>
                  <Select.Option value="in_progress">En Progreso</Select.Option>
                  <Select.Option value="completed">Completada</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="dates"
            label="Rango de Fechas (Inicio - Fin)"
            rules={[{ required: true, message: 'Selecciona las fechas de inicio y fin' }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder={['Fecha Inicio', 'Fecha Fin']}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '8px', marginTop: '8px' }}>
            <InfoCircleOutlined style={{ color: '#1677ff', marginTop: '3px' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Nota: Las órdenes en estado <strong>Planificada</strong> pueden ser reprogramadas automáticamente
              si entran en conflicto de horarios con otras órdenes planificadas.
            </Text>
          </div>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
